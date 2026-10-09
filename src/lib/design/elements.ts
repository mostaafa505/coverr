import type { DesignElement, ImageAdjust, ImageElement, ShapeElement, ShapeKind, TextElement } from '@/types';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);

export const NEUTRAL_ADJUST: ImageAdjust = { brightness: 0, contrast: 0, saturation: 0, grayscale: false, sepia: 0 };

export const isNeutralAdjust = (a: ImageAdjust) =>
  a.brightness === 0 && a.contrast === 0 && a.saturation === 0 && !a.grayscale && a.sepia === 0;

export function newImage(
  src: string,
  nw: number,
  nh: number,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
  name?: string
): ImageElement {
  const ratio = nw / nh;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) {
    h = maxH;
    w = h * ratio;
  }
  return {
    id: uid(),
    kind: 'image',
    x: cx,
    y: cy,
    rotation: 0,
    opacity: 1,
    src,
    nw,
    nh,
    crop: { x: 0, y: 0, w: 1, h: 1 },
    w,
    h,
    flipX: false,
    flipY: false,
    adjust: { ...NEUTRAL_ADJUST },
    name,
  };
}

export function newText(text: string, cx: number, cy: number, fontFamily: string, fontSize: number, fill: string): TextElement {
  return {
    id: uid(),
    kind: 'text',
    x: cx,
    y: cy,
    rotation: 0,
    opacity: 1,
    text,
    fontFamily,
    fontSize,
    fill,
    bold: true,
    italic: false,
    align: 'center',
    stroke: '#000000',
    strokeWidth: 0,
    lineHeight: 1.25,
  };
}

export function newShape(shape: ShapeKind, cx: number, cy: number, size: number, fill: string): ShapeElement {
  return {
    id: uid(),
    kind: 'shape',
    shape,
    x: cx,
    y: cy,
    rotation: 0,
    opacity: 1,
    w: size,
    h: shape === 'rect' || shape === 'ellipse' ? size : size * 0.92,
    fill,
    stroke: '#000000',
    strokeWidth: 0,
    radius: 0,
  };
}

// ───────── قياس النص ─────────

const PX = 20; // دقة القياس (بكسل لكل ملّيمتر) – كافية لدقة الأبعاد

let measureCtx: CanvasRenderingContext2D | null = null;
function ctx2d(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}

export const hasArabic = (s: string) => /[֐-ࣿיִ-﷿ﹰ-﻿]/.test(s);

export function fontString(el: TextElement, pxPerMm: number): string {
  return `${el.italic ? 'italic ' : ''}${el.bold ? 700 : 400} ${el.fontSize * pxPerMm}px "${el.fontFamily}", sans-serif`;
}

export interface TextLayout {
  /** مسافة جانبية صغيرة حوالين النص */
  padX: number;
  lines: string[];
  w: number;
  h: number;
  lineH: number;
}

const layoutCache = new Map<string, TextLayout>();

export function layoutText(el: TextElement): TextLayout {
  const key = `${el.text}|${el.fontFamily}|${el.fontSize}|${el.bold}|${el.italic}|${el.lineHeight}|${el.strokeWidth}`;
  const hit = layoutCache.get(key);
  if (hit) return hit;
  const lines = (el.text || ' ').split('\n');
  const c = ctx2d();
  let w = 0;
  if (c) {
    c.font = fontString(el, PX);
    c.direction = hasArabic(el.text) ? 'rtl' : 'ltr';
    for (const l of lines) w = Math.max(w, c.measureText(l || ' ').width / PX);
  } else {
    w = Math.max(...lines.map((l) => l.length)) * el.fontSize * 0.55;
  }
  const lineH = el.fontSize * el.lineHeight;
  const pad = el.strokeWidth;
  const padX = el.fontSize * 0.1;
  const out = { padX, lines, w: w + pad + padX * 2, h: lineH * lines.length + pad, lineH };
  if (layoutCache.size > 400) layoutCache.clear();
  layoutCache.set(key, out);
  return out;
}

export function clearTextLayoutCache() {
  layoutCache.clear();
}

export function elementSize(el: DesignElement): { w: number; h: number } {
  if (el.kind === 'text') {
    const l = layoutText(el);
    return { w: l.w, h: l.h };
  }
  return { w: el.w, h: el.h };
}

// ───────── هندسة ─────────

export interface Pt {
  x: number;
  y: number;
}

export function toLocal(el: DesignElement, p: Pt): Pt {
  const a = (-el.rotation * Math.PI) / 180;
  const dx = p.x - el.x;
  const dy = p.y - el.y;
  return { x: dx * Math.cos(a) - dy * Math.sin(a), y: dx * Math.sin(a) + dy * Math.cos(a) };
}

export function toWorld(el: DesignElement, p: Pt): Pt {
  const a = (el.rotation * Math.PI) / 180;
  return { x: el.x + p.x * Math.cos(a) - p.y * Math.sin(a), y: el.y + p.x * Math.sin(a) + p.y * Math.cos(a) };
}

export function hitElement(el: DesignElement, p: Pt, tolerance = 0): boolean {
  const { w, h } = elementSize(el);
  const l = toLocal(el, p);
  return Math.abs(l.x) <= w / 2 + tolerance && Math.abs(l.y) <= h / 2 + tolerance;
}

export function corners(el: DesignElement): Pt[] {
  const { w, h } = elementSize(el);
  return [
    toWorld(el, { x: -w / 2, y: -h / 2 }),
    toWorld(el, { x: w / 2, y: -h / 2 }),
    toWorld(el, { x: w / 2, y: h / 2 }),
    toWorld(el, { x: -w / 2, y: h / 2 }),
  ];
}

export function aabb(el: DesignElement) {
  const c = corners(el);
  const xs = c.map((p) => p.x);
  const ys = c.map((p) => p.y);
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

export function elementLabel(el: DesignElement): string {
  if (el.kind === 'image') return el.name || 'صورة';
  if (el.kind === 'text') return el.text.split('\n')[0].slice(0, 24) || 'نص';
  const names: Record<string, string> = { rect: 'مستطيل', ellipse: 'دائرة', triangle: 'مثلث', heart: 'قلب', star: 'نجمة' };
  return names[el.shape] || 'شكل';
}
