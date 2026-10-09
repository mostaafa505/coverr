import type { Background, Design, DesignElement, ImageElement, ShapeElement, TextElement } from '@/types';
import { fontString, hasArabic, layoutText } from './elements';
import type { ImageStore } from './images';
import { shapePath, toCanvasPath } from './path';

export interface Area {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function drawBackground(ctx: CanvasRenderingContext2D, bg: Background, area: Area) {
  if (bg.type === 'transparent') return;
  if (bg.type === 'solid') {
    ctx.fillStyle = bg.color;
  } else {
    const a = (bg.angle * Math.PI) / 180; // مثل CSS: 0 = لأعلى، 90 = لليمين
    const cx = area.x + area.w / 2;
    const cy = area.y + area.h / 2;
    const len = Math.abs(area.w * Math.sin(a)) + Math.abs(area.h * Math.cos(a));
    const dx = (Math.sin(a) * len) / 2;
    const dy = (-Math.cos(a) * len) / 2;
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
    g.addColorStop(0, bg.from);
    g.addColorStop(1, bg.to);
    ctx.fillStyle = g;
  }
  ctx.fillRect(area.x, area.y, area.w, area.h);
}

function drawImageEl(ctx: CanvasRenderingContext2D, el: ImageElement, images: ImageStore, pxPerMm: number, full: boolean) {
  const d = images.prepare(el, pxPerMm, full);
  if (!d) return;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (el.flipX || el.flipY) ctx.scale(el.flipX ? -1 : 1, el.flipY ? -1 : 1);
  ctx.drawImage(d.src, d.sx, d.sy, d.sw, d.sh, -el.w / 2, -el.h / 2, el.w, el.h);
}

function drawTextEl(ctx: CanvasRenderingContext2D, el: TextElement) {
  const l = layoutText(el);
  // نرسم بدقة أعلى من الملّيمتر لأن الخطوط بالبكسل: نكبّر السياق مؤقتًا
  const S = 20;
  ctx.save();
  ctx.scale(1 / S, 1 / S);
  ctx.font = fontString(el, S);
  ctx.direction = hasArabic(el.text) ? 'rtl' : 'ltr';
  ctx.textBaseline = 'middle';
  ctx.textAlign = el.align;
  ctx.lineJoin = 'round';
  const top = -l.h / 2 + el.strokeWidth / 2;
  const edge = el.strokeWidth / 2 + l.padX;
  const ax = el.align === 'left' ? -l.w / 2 + edge : el.align === 'right' ? l.w / 2 - edge : 0;
  for (let i = 0; i < l.lines.length; i++) {
    const y = (top + l.lineH * (i + 0.5)) * S;
    if (el.strokeWidth > 0) {
      ctx.lineWidth = el.strokeWidth * S * 2;
      ctx.strokeStyle = el.stroke;
      ctx.strokeText(l.lines[i], ax * S, y);
    }
    ctx.fillStyle = el.fill;
    ctx.fillText(l.lines[i], ax * S, y);
  }
  ctx.restore();
}

function drawShapeEl(ctx: CanvasRenderingContext2D, el: ShapeElement) {
  const p = toCanvasPath(shapePath(el.shape, el.w, el.h, el.radius));
  ctx.fillStyle = el.fill;
  ctx.fill(p);
  if (el.strokeWidth > 0) {
    ctx.lineWidth = el.strokeWidth;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = el.stroke;
    ctx.stroke(p);
  }
}

export function drawElement(ctx: CanvasRenderingContext2D, el: DesignElement, images: ImageStore, pxPerMm: number, full = false) {
  if (el.hidden || el.opacity <= 0) return;
  ctx.save();
  ctx.globalAlpha = el.opacity;
  ctx.translate(el.x, el.y);
  if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180);
  if (el.kind === 'image') drawImageEl(ctx, el, images, pxPerMm, full);
  else if (el.kind === 'text') drawTextEl(ctx, el);
  else drawShapeEl(ctx, el);
  ctx.restore();
}

/** يرسم التصميم كله. السياق لازم يكون بوحدة الملّيمتر (origin = ركن خط القص) */
export function drawDesign(ctx: CanvasRenderingContext2D, design: Design, images: ImageStore, area: Area, pxPerMm: number, full = false) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(area.x, area.y, area.w, area.h);
  ctx.clip();
  drawBackground(ctx, design.background, area);
  for (const el of design.elements) drawElement(ctx, el, images, pxPerMm, full);
  ctx.restore();
}

/** تأكد من تحميل الخطوط المستخدمة قبل الرسم/التصدير */
export async function ensureFonts(design: Design): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const jobs: Promise<unknown>[] = [];
  for (const el of design.elements) {
    if (el.kind === 'text') jobs.push(document.fonts.load(fontString(el, 40), el.text || 'ا'));
  }
  await Promise.allSettled(jobs);
}
