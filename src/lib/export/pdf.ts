import { PDFDocument, PDFName, PDFRawStream, PDFRef, PDFString, StandardFonts } from 'pdf-lib';
import type { DeviceModel, ExportOptions } from '@/types';
import { cutoutPath, mirrorPathX, outlinePath, type Seg } from '@/lib/design/path';
import { srgbProfile } from './icc';
import { canvasToBlob, type RasterResult } from './raster';

const K = 72 / 25.4; // ملّيمتر → نقطة PDF
export const SLUG_MM = 9; // هامش خارج منطقة الـ bleed لعلامات القص ومعلومات الشغل

const n = (v: number) => (Math.round(v * 1000) / 1000).toString();

/** مرشّح PNG "Up" – بيخلي الضغط أصغر بكتير للصور الفوتوغرافية والتدرجات */
function predictUp(raw: Uint8Array, rowBytes: number, rows: number): Uint8Array {
  const out = new Uint8Array((rowBytes + 1) * rows);
  for (let r = 0; r < rows; r++) {
    const o = r * (rowBytes + 1);
    const s = r * rowBytes;
    out[o] = 2;
    if (r === 0) {
      out.set(raw.subarray(s, s + rowBytes), o + 1);
    } else {
      const p = s - rowBytes;
      for (let i = 0; i < rowBytes; i++) out[o + 1 + i] = (raw[s + i] - raw[p + i]) & 255;
    }
  }
  return out;
}

const ascii = (s: string, max = 60) =>
  s
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[()\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

function pathOps(segs: Seg[], px: (x: number) => number, py: (y: number) => number): string {
  let s = '';
  for (const g of segs) {
    if (g[0] === 'M') s += `${n(px(g[1]))} ${n(py(g[2]))} m\n`;
    else if (g[0] === 'L') s += `${n(px(g[1]))} ${n(py(g[2]))} l\n`;
    else if (g[0] === 'C') s += `${n(px(g[1]))} ${n(py(g[2]))} ${n(px(g[3]))} ${n(py(g[4]))} ${n(px(g[5]))} ${n(py(g[6]))} c\n`;
    else s += 'h\n';
  }
  return s;
}

export interface PdfInput {
  raster: RasterResult;
  model: DeviceModel;
  bleedMm: number;
  options: ExportOptions;
  jobId: string;
  /** صورة تحتوي شفافية فعلية */
  hasAlpha: boolean;
}

export async function buildPrintPdf(input: PdfInput): Promise<Uint8Array> {
  const { raster, model, bleedMm, options, jobId } = input;
  const t = model.template;
  const bleedW = t.widthMm + bleedMm * 2;
  const bleedH = t.heightMm + bleedMm * 2;
  const pageWmm = bleedW + SLUG_MM * 2;
  const pageHmm = bleedH + SLUG_MM * 2;
  const pageW = pageWmm * K;
  const pageH = pageHmm * K;

  const doc = await PDFDocument.create();
  const ctx = doc.context;
  const page = doc.addPage([pageW, pageH]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // مربعات الطباعة القياسية (TrimBox / BleedBox) – بيفهمها أي RIP أو برنامج صف
  const trimX = (SLUG_MM + bleedMm) * K;
  const trimY = (SLUG_MM + bleedMm) * K;
  page.setTrimBox(trimX, trimY, t.widthMm * K, t.heightMm * K);
  page.setBleedBox(SLUG_MM * K, SLUG_MM * K, bleedW * K, bleedH * K);
  page.setArtBox(SLUG_MM * K, SLUG_MM * K, bleedW * K, bleedH * K);

  // ── الصورة: RGB مدموغ بملف sRGB، 300 DPI بالضبط ──
  const { widthPx: W, heightPx: H } = raster;
  const g = raster.canvas.getContext('2d', { willReadFrequently: true })!;
  const rgba = g.getImageData(0, 0, W, H).data;

  const iccRef = ctx.register(ctx.flateStream(srgbProfile(), { N: 3, Alternate: 'DeviceRGB' }));
  const colorSpace = ctx.obj(['ICCBased', iccRef]);

  let artRef: PDFRef;
  if (options.smallFile && !input.hasAlpha) {
    const blob = await canvasToBlob(raster.canvas, 'image/jpeg', 0.95);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const dict = ctx.obj({
      Type: 'XObject',
      Subtype: 'Image',
      Width: W,
      Height: H,
      ColorSpace: colorSpace,
      BitsPerComponent: 8,
      Filter: 'DCTDecode',
      Interpolate: false,
    });
    artRef = ctx.register(PDFRawStream.of(dict as never, bytes));
  } else {
    const rgb = new Uint8Array(W * H * 3);
    const alpha = input.hasAlpha ? new Uint8Array(W * H) : null;
    for (let i = 0, p = 0, a = 0; i < rgba.length; i += 4) {
      rgb[p++] = rgba[i];
      rgb[p++] = rgba[i + 1];
      rgb[p++] = rgba[i + 2];
      if (alpha) alpha[a++] = rgba[i + 3];
    }
    let smaskRef: PDFRef | undefined;
    if (alpha) {
      smaskRef = ctx.register(
        ctx.flateStream(predictUp(alpha, W, H), {
          Type: 'XObject',
          Subtype: 'Image',
          Width: W,
          Height: H,
          ColorSpace: 'DeviceGray',
          BitsPerComponent: 8,
          DecodeParms: { Predictor: 15, Colors: 1, BitsPerComponent: 8, Columns: W },
        })
      );
    }
    const dict: Record<string, unknown> = {
      Type: 'XObject',
      Subtype: 'Image',
      Width: W,
      Height: H,
      ColorSpace: colorSpace,
      BitsPerComponent: 8,
      Interpolate: false,
      DecodeParms: { Predictor: 15, Colors: 3, BitsPerComponent: 8, Columns: W },
    };
    if (smaskRef) dict.SMask = smaskRef;
    artRef = ctx.register(ctx.flateStream(predictUp(rgb, W * 3, H), dict as never));
  }

  // ── طبقات اختيارية (يقدر المشغّل يخفيها من أي برنامج) ──
  const ocgArt = ctx.register(ctx.obj({ Type: 'OCG', Name: PDFString.of('Artwork') }));
  const ocgCut = ctx.register(ctx.obj({ Type: 'OCG', Name: PDFString.of('CutContour') }));
  doc.catalog.set(PDFName.of('OCProperties'), ctx.obj({ OCGs: [ocgArt, ocgCut], D: { Order: [ocgArt, ocgCut], ON: [ocgArt, ocgCut] } }));

  // لون خاص (Spot) اسمه CutContour – المعيار اللي بتفهمه برامج Roland / Mimaki / Graphtec
  const tint = ctx.obj({ FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: [0, 1, 0, 0], N: 1 });
  const cutCs = ctx.obj(['Separation', 'CutContour', 'DeviceCMYK', tint]);
  const gsOverprint = ctx.obj({ Type: 'ExtGState', OP: true, op: true, OPM: 1 });

  page.node.set(
    PDFName.of('Resources'),
    ctx.obj({
      XObject: { Art: artRef },
      ColorSpace: { CutContour: cutCs },
      ExtGState: { GSop: gsOverprint },
      Font: { F1: font.ref, F2: fontBold.ref },
      Properties: { OCArt: ocgArt, OCCut: ocgCut },
    })
  );

  // ── محتوى الصفحة ──
  const X = (mm: number) => mm * K;
  const Y = (mmFromTop: number) => pageH - mmFromTop * K;
  const trimL = SLUG_MM + bleedMm;
  const trimT = SLUG_MM + bleedMm;
  const trimR = trimL + t.widthMm;
  const trimB = trimT + t.heightMm;

  let c = '';
  // 1) الصورة
  c += `/OC /OCArt BDC\nq\n${n(bleedW * K)} 0 0 ${n(bleedH * K)} ${n(SLUG_MM * K)} ${n(SLUG_MM * K)} cm\n/Art Do\nQ\nEMC\n`;

  // 2) علامات القص (تبدأ بعد الـ bleed بمسافة 1 مم عشان ما تتطبعش على الصورة)
  const gap = bleedMm + 1;
  const len = Math.min(5, SLUG_MM - 1.5);
  c += 'q\n0 0 0 RG\n0 0 0 rg\n0.25 w\n';
  const mark = (x1: number, y1: number, x2: number, y2: number) => {
    c += `${n(X(x1))} ${n(Y(y1))} m ${n(X(x2))} ${n(Y(y2))} l S\n`;
  };
  for (const x of [trimL, trimR]) {
    mark(x, trimT - gap, x, trimT - gap - len);
    mark(x, trimB + gap, x, trimB + gap + len);
  }
  for (const y of [trimT, trimB]) {
    mark(trimL - gap, y, trimL - gap - len, y);
    mark(trimR + gap, y, trimR + gap + len, y);
  }

  // 3) علامات تسجيل (اختياري) لماكينات القص الضوئية
  if (options.registrationMarks) {
    const o = SLUG_MM / 2;
    const pts: [number, number][] = [
      [o, o],
      [pageWmm - o, o],
      [o, pageHmm - o],
      [pageWmm - o, pageHmm - o],
    ];
    for (const [mx, my] of pts) {
      const r = 1.6 * K;
      const cx = X(mx);
      const cy = Y(my);
      const kk = r * 0.5523;
      c += `${n(cx + r)} ${n(cy)} m ${n(cx + r)} ${n(cy + kk)} ${n(cx + kk)} ${n(cy + r)} ${n(cx)} ${n(cy + r)} c ${n(cx - kk)} ${n(cy + r)} ${n(cx - r)} ${n(cy + kk)} ${n(cx - r)} ${n(cy)} c ${n(cx - r)} ${n(cy - kk)} ${n(cx - kk)} ${n(cy - r)} ${n(cx)} ${n(cy - r)} c ${n(cx + kk)} ${n(cy - r)} ${n(cx + r)} ${n(cy - kk)} ${n(cx + r)} ${n(cy)} c f\n`;
      const arm = 3.4 * K;
      c += `${n(cx - arm)} ${n(cy)} m ${n(cx + arm)} ${n(cy)} l S ${n(cx)} ${n(cy - arm)} m ${n(cx)} ${n(cy + arm)} l S\n`;
    }
  }
  c += 'Q\n';

  // 4) خط القص كلون خاص فوق الطباعة (بدون ما يمسح اللي تحته)
  if (options.cutLineInPdf) {
    const px = (x: number) => X(trimL + x);
    const py = (y: number) => Y(trimT + y);
    let paths: Seg[][] = [outlinePath(t), ...t.cutouts.map(cutoutPath)];
    if (options.mirror) paths = paths.map((p) => mirrorPathX(p, t.widthMm));
    c += '/OC /OCCut BDC\nq\n/GSop gs\n/CutContour CS 1 SCN\n0.25 w\n';
    for (const p of paths) c += pathOps(p, px, py) + 'S\n';
    c += 'Q\nEMC\n';
  }

  // 5) معلومات الشغل في الهامش (إنجليزي بس عشان خط PDF القياسي)
  const info = ascii(`JOB ${jobId}  ${ascii(model.name, 26)}  ${t.widthMm}x${t.heightMm} mm  bleed ${bleedMm}  300 dpi  100%`, 80);
  c += `BT\n/F1 5 Tf\n0.25 g\n${n(X(SLUG_MM))} ${n(Y(1.9))} Td\n(${info}) Tj\nET\n`;
  if (options.mirror) {
    c += `BT\n/F2 5.5 Tf\n0.1 g\n${n(X(SLUG_MM))} ${n(Y(pageHmm - 1.1))} Td\n(MIRRORED - sublimation transfer, do not flip again) Tj\nET\n`;
  }

  page.node.addContentStream(ctx.register(ctx.flateStream(c)));

  doc.setTitle(`${jobId} - ${ascii(model.name, 40)}`);
  doc.setProducer('Cover Print');
  doc.setCreator('Cover Print');
  doc.setCreationDate(new Date());

  return doc.save({ useObjectStreams: false });
}
