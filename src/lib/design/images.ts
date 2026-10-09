import type { ImageElement } from '@/types';
import { isNeutralAdjust } from './elements';
import type { ImageAdjust } from '@/types';

const PREVIEW_MAX = 1600;

export interface Drawable {
  src: CanvasImageSource;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** تصغير بجودة عالية على مراحل (يمنع التكسير في Safari وغيره) */
export function scaleDown(
  src: CanvasImageSource,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  tw: number,
  th: number
): HTMLCanvasElement {
  let cur: CanvasImageSource = src;
  let cx = sx;
  let cy = sy;
  let cw = sw;
  let ch = sh;
  while (cw / 2 >= tw && ch / 2 >= th) {
    const nw = Math.max(tw, Math.floor(cw / 2));
    const nh = Math.max(th, Math.floor(ch / 2));
    const step = makeCanvas(nw, nh);
    const g = step.getContext('2d')!;
    g.imageSmoothingQuality = 'high';
    g.drawImage(cur, cx, cy, cw, ch, 0, 0, nw, nh);
    cur = step;
    cx = 0;
    cy = 0;
    cw = nw;
    ch = nh;
  }
  const out = makeCanvas(tw, th);
  const g = out.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(cur, cx, cy, cw, ch, 0, 0, tw, th);
  return out;
}

/** تعديل ألوان على البيكسلات مباشرة (يعمل في كل المتصفحات بدون ctx.filter) */
export function applyAdjust(canvas: HTMLCanvasElement, a: ImageAdjust) {
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const b = a.brightness * 2.55;
  const c255 = a.contrast * 2.55;
  const cf = (259 * (c255 + 255)) / (255 * (259 - c255));
  const sat = 1 + a.saturation / 100;
  const sep = a.sepia / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i];
    let gg = d[i + 1];
    let bl = d[i + 2];
    if (b !== 0) {
      r += b;
      gg += b;
      bl += b;
    }
    if (c255 !== 0) {
      r = cf * (r - 128) + 128;
      gg = cf * (gg - 128) + 128;
      bl = cf * (bl - 128) + 128;
    }
    if (a.grayscale) {
      const l = 0.299 * r + 0.587 * gg + 0.114 * bl;
      r = gg = bl = l;
    } else if (sat !== 1) {
      const l = 0.299 * r + 0.587 * gg + 0.114 * bl;
      r = l + (r - l) * sat;
      gg = l + (gg - l) * sat;
      bl = l + (bl - l) * sat;
    }
    if (sep > 0) {
      const sr = 0.393 * r + 0.769 * gg + 0.189 * bl;
      const sg = 0.349 * r + 0.686 * gg + 0.168 * bl;
      const sb = 0.272 * r + 0.534 * gg + 0.131 * bl;
      r += (sr - r) * sep;
      gg += (sg - gg) * sep;
      bl += (sb - bl) * sep;
    }
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = bl;
  }
  g.putImageData(img, 0, 0);
}

export class ImageStore {
  private full = new Map<string, HTMLImageElement>();
  private preview = new Map<string, CanvasImageSource>();
  private processed = new Map<string, HTMLCanvasElement>();
  private pending = new Map<string, Promise<HTMLImageElement>>();
  onLoad?: () => void;

  has(src: string) {
    return this.full.has(src);
  }

  load(src: string): Promise<HTMLImageElement> {
    const done = this.full.get(src);
    if (done) return Promise.resolve(done);
    const p = this.pending.get(src);
    if (p) return p;
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        this.full.set(src, img);
        const long = Math.max(img.naturalWidth, img.naturalHeight);
        if (long > PREVIEW_MAX) {
          const k = PREVIEW_MAX / long;
          this.preview.set(
            src,
            scaleDown(img, 0, 0, img.naturalWidth, img.naturalHeight, Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k))
          );
        } else {
          this.preview.set(src, img);
        }
        this.pending.delete(src);
        this.onLoad?.();
        resolve(img);
      };
      img.onerror = () => {
        this.pending.delete(src);
        reject(new Error('تعذر قراءة الصورة'));
      };
      img.src = src;
    });
    this.pending.set(src, promise);
    return promise;
  }

  release(src: string) {
    this.full.delete(src);
    this.preview.delete(src);
    for (const k of this.processed.keys()) if (k.startsWith(src)) this.processed.delete(k);
  }

  /**
   * جهّز الصورة للرسم.
   * للشاشة: نسخة معاينة خفيفة. للتصدير (full): الصورة الأصلية بعد تصغيرها بجودة عالية لمقاس الطباعة.
   */
  prepare(el: ImageElement, pxPerMm: number, full = false): Drawable | null {
    const base = full ? this.full.get(el.src) : this.preview.get(el.src);
    if (!base) return null;
    const bw = full ? (base as HTMLImageElement).naturalWidth : (base as HTMLImageElement | HTMLCanvasElement).width;
    const bh = full ? (base as HTMLImageElement).naturalHeight : (base as HTMLImageElement | HTMLCanvasElement).height;
    const sx = el.crop.x * bw;
    const sy = el.crop.y * bh;
    const sw = el.crop.w * bw;
    const sh = el.crop.h * bh;
    const neutral = isNeutralAdjust(el.adjust);

    const wantW = Math.max(1, Math.round(el.w * pxPerMm));
    const wantH = Math.max(1, Math.round(el.h * pxPerMm));

    if (full) {
      // تصغير بجودة عالية لو الصورة أكبر من مقاس الطباعة بوضوح
      if (sw > wantW * 1.5 || !neutral) {
        const tw = Math.min(wantW, Math.round(sw));
        const th = Math.min(wantH, Math.round(sh));
        const c = scaleDown(base, sx, sy, sw, sh, tw, th);
        if (!neutral) applyAdjust(c, el.adjust);
        return { src: c, sx: 0, sy: 0, sw: c.width, sh: c.height };
      }
      return { src: base, sx, sy, sw, sh };
    }

    if (neutral) return { src: base, sx, sy, sw, sh };

    // شاشة + تعديلات: خزّن نسخة معالجة بمقاس مناسب
    const bucket = Math.min(Math.round(sw), Math.pow(2, Math.ceil(Math.log2(Math.max(64, wantW)))));
    const key = `${el.src}|${el.crop.x},${el.crop.y},${el.crop.w},${el.crop.h}|${JSON.stringify(el.adjust)}|${bucket}`;
    let c = this.processed.get(key);
    if (!c) {
      const tw = Math.max(1, Math.min(bucket, Math.round(sw)));
      const th = Math.max(1, Math.round(tw * (sh / sw)));
      c = scaleDown(base, sx, sy, sw, sh, tw, th);
      applyAdjust(c, el.adjust);
      if (this.processed.size > 40) this.processed.delete(this.processed.keys().next().value as string);
      this.processed.set(key, c);
    }
    return { src: c, sx: 0, sy: 0, sw: c.width, sh: c.height };
  }
}
