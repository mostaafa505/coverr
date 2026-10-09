import type { Design, DeviceModel, ExportOptions } from '@/types';
import type { ImageStore } from '@/lib/design/images';
import { buildPrintPdf } from './pdf';
import { buildProof } from './proof';
import { buildCutSvg } from './svg';
import { canvasHasTransparency, canvasToBlob, DPI, renderPrintRaster } from './raster';
import { setPngDpi } from './png';
import { zipFiles } from './zip';
export { OPTION_DEFAULTS } from './defaults';

export interface ExportFile {
  name: string;
  blob: Blob;
  label: string;
  hint: string;
  primary?: boolean;
}

export interface ExportResult {
  jobId: string;
  files: ExportFile[];
  zip: ExportFile;
  summary: {
    trim: string;
    bleedMm: number;
    pixels: string;
    mirrored: boolean;
    pdfSizeMb: number;
  };
}

export function makeJobId(d = new Date()): string {
  const p = (v: number) => String(v).padStart(2, '0');
  return `CP-${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

const mb = (b: Blob) => Math.round((b.size / 1048576) * 10) / 10;

export async function runExport(
  design: Design,
  model: DeviceModel,
  bleedMm: number,
  images: ImageStore,
  options: ExportOptions,
  onStep?: (msg: string) => void
): Promise<ExportResult> {
  const jobId = makeJobId();
  const t = model.template;

  onStep?.('بجهّز الصورة بدقة 300 DPI…');
  const raster = await renderPrintRaster(design, model, bleedMm, images, { mirror: options.mirror });
  const hasAlpha = canvasHasTransparency(raster.canvas);

  onStep?.('بكتب ملف الـ PDF…');
  const pdfBytes = await buildPrintPdf({
    raster,
    model,
    bleedMm,
    options,
    jobId,
    hasAlpha: hasAlpha && design.background.type === 'transparent',
  });
  const pdf = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });

  onStep?.('بجهّز ملف القص والمراجعة…');
  const svg = new Blob([buildCutSvg(model, jobId, options.registrationMarks)], { type: 'image/svg+xml' });
  // المراجعة دايمًا بالاتجاه الطبيعي (بدون قلب)
  const proof = await buildProof(design, model, bleedMm, images, jobId);

  const png = await setPngDpi(await canvasToBlob(raster.canvas, 'image/png'), DPI);

  const files: ExportFile[] = [
    { name: `${jobId}_PRINT.pdf`, blob: pdf, label: 'ملف الطباعة (PDF)', hint: 'ده الملف اللي يتبعت للطابعة / الـ RIP', primary: true },
    { name: `${jobId}_CUT.svg`, blob: svg, label: 'ملف القص (SVG)', hint: 'خط القص بالمقاس الحقيقي للكتر أو الليزر' },
    { name: `${jobId}_ART_300dpi.png`, blob: png, label: 'الصورة فقط (PNG)', hint: 'نفس الطباعة بدون علامات، 300 DPI' },
    { name: `${jobId}_PROOF.jpg`, blob: proof, label: 'صورة مراجعة (JPG)', hint: 'للمعاينة بالعين فقط، مش للطباعة' },
  ];

  if (options.whiteInk) {
    onStep?.('بجهّز طبقة الحبر الأبيض…');
    files.splice(3, 0, {
      name: `${jobId}_WHITE_mask.png`,
      blob: await buildWhiteMask(raster.canvas),
      label: 'طبقة الحبر الأبيض (PNG)',
      hint: 'الأسود = مكان الحبر الأبيض',
    });
  }

  const zip = await zipFiles(files);
  return {
    jobId,
    files,
    zip: { name: `${jobId}.zip`, blob: zip, label: 'كل الملفات (ZIP)', hint: `${files.length} ملفات في ملف واحد` },
    summary: {
      trim: `${t.widthMm} × ${t.heightMm}`,
      bleedMm,
      pixels: `${raster.widthPx} × ${raster.heightPx}`,
      mirrored: options.mirror,
      pdfSizeMb: mb(pdf),
    },
  };
}

async function buildWhiteMask(src: HTMLCanvasElement): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const ink = d[i + 3] > 12 ? 0 : 255; // أسود = حبر
    d[i] = d[i + 1] = d[i + 2] = ink;
    d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return setPngDpi(await canvasToBlob(c, 'image/png'), DPI);
}
