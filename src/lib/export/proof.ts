import type { Design, DeviceModel } from '@/types';
import type { ImageStore } from '@/lib/design/images';
import { cutoutPath, outlinePath, toCanvasPath } from '@/lib/design/path';
import { drawDesign, ensureFonts } from '@/lib/design/render';
import { canvasToBlob } from './raster';

/**
 * صورة مراجعة (JPG) للمعاينة السريعة: التصميم + خط القص + منطقة الأمان + الأبعاد.
 * مش للطباعة – للتأكد بالعين قبل ما تبعت الملف للماكينة.
 */
export async function buildProof(design: Design, model: DeviceModel, bleedMm: number, images: ImageStore, jobId: string): Promise<Blob> {
  await ensureFonts(design);
  const t = model.template;
  const S = 6; // بكسل لكل مم
  const pad = 14; // مم
  const head = 16;
  const foot = 14;
  const bw = t.widthMm + bleedMm * 2;
  const bh = t.heightMm + bleedMm * 2;
  const W = Math.round((bw + pad * 2) * S);
  const H = Math.round((bh + pad * 2 + head + foot) * S);

  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);

  g.save();
  g.scale(S, S);
  g.translate(pad + bleedMm, pad + head + bleedMm);

  // خلفية شطرنج للشفاف
  const area = { x: -bleedMm, y: -bleedMm, w: bw, h: bh };
  if (design.background.type === 'transparent') {
    g.fillStyle = '#eee';
    g.fillRect(area.x, area.y, area.w, area.h);
  }
  drawDesign(g, design, images, area, S, true);

  // يعتّم منطقة الـ bleed (اللي هتتقص)
  g.save();
  const dim = new Path2D();
  dim.rect(area.x, area.y, area.w, area.h);
  dim.addPath(toCanvasPath(outlinePath(t)));
  g.fillStyle = 'rgba(20,20,20,0.38)';
  g.fill(dim, 'evenodd');
  g.restore();

  // الفتحات
  for (const co of t.cutouts) {
    const p = toCanvasPath(cutoutPath(co));
    g.fillStyle = 'rgba(255,255,255,0.88)';
    g.fill(p);
    g.lineWidth = 0.25;
    g.strokeStyle = '#EC008C';
    g.stroke(p);
  }
  // خط القص
  g.lineWidth = 0.3;
  g.strokeStyle = '#EC008C';
  g.stroke(toCanvasPath(outlinePath(t)));
  // منطقة الأمان
  g.setLineDash([1.2, 1]);
  g.lineWidth = 0.2;
  g.strokeStyle = '#1b9aaa';
  const sm = t.safeMarginMm;
  g.strokeRect(sm, sm, t.widthMm - sm * 2, t.heightMm - sm * 2);
  g.restore();

  g.fillStyle = '#1d1b17';
  g.textBaseline = 'alphabetic';
  g.font = '600 15px "IBM Plex Sans Arabic", sans-serif';
  g.direction = 'ltr';
  g.fillText(`${model.name}`, pad * S, (pad * 0.6 + 4) * S);
  g.font = '400 11px "IBM Plex Sans Arabic", sans-serif';
  g.fillStyle = '#55514A';
  g.fillText(`${jobId}`, pad * S, (pad * 0.6 + 4) * S + 16);
  const info = `${t.widthMm} × ${t.heightMm} mm  ·  bleed ${bleedMm} mm  ·  magenta = cut line, dashed = safe zone`;
  g.fillText(info, pad * S, H - (foot * S) / 2);

  return canvasToBlob(c, 'image/jpeg', 0.9);
}
