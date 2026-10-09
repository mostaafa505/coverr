import type { Design, DeviceModel } from '@/types';
import type { ImageStore } from '@/lib/design/images';
import { drawDesign, ensureFonts } from '@/lib/design/render';

export const DPI = 300;
export const MM_TO_PX = DPI / 25.4;

export interface RasterResult {
  canvas: HTMLCanvasElement;
  widthPx: number;
  heightPx: number;
  pxPerMm: number;
}

/**
 * يرسم منطقة الطباعة كاملة (القص + الهامش) بدقة 300 DPI.
 * mirror: قلب أفقي للسبلميشن (النص والصور تنقلب صح).
 */
export async function renderPrintRaster(
  design: Design,
  model: DeviceModel,
  bleedMm: number,
  images: ImageStore,
  opts: { mirror: boolean; dpi?: number }
): Promise<RasterResult> {
  await ensureFonts(design);
  const t = model.template;
  const pxPerMm = (opts.dpi ?? DPI) / 25.4;
  const totalW = t.widthMm + bleedMm * 2;
  const totalH = t.heightMm + bleedMm * 2;
  const widthPx = Math.round(totalW * pxPerMm);
  const heightPx = Math.round(totalH * pxPerMm);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('المتصفح ما قدرش يجهز مساحة الرسم. جرّب تقفل تبويبات تانية وحاول تاني.');

  // نسبة حقيقية بين البكسل والملّيمتر بعد التقريب
  const sx = widthPx / totalW;
  const sy = heightPx / totalH;
  ctx.scale(sx, sy);
  if (opts.mirror) {
    ctx.translate(totalW, 0);
    ctx.scale(-1, 1);
  }
  ctx.translate(bleedMm, bleedMm);
  drawDesign(ctx, design, images, { x: -bleedMm, y: -bleedMm, w: totalW, h: totalH }, pxPerMm, true);
  return { canvas, widthPx, heightPx, pxPerMm };
}

export function canvasHasTransparency(c: HTMLCanvasElement): boolean {
  // نفحص عيّنة صغيرة بدل الصورة كلها
  const probe = document.createElement('canvas');
  probe.width = 96;
  probe.height = Math.max(1, Math.round((96 * c.height) / c.width));
  const g = probe.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(c, 0, 0, probe.width, probe.height);
  const d = g.getImageData(0, 0, probe.width, probe.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
  return false;
}

export function canvasToBlob(c: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('فشل تحويل الصورة'))), type, quality);
  });
}
