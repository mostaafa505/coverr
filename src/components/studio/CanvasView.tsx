'use client';

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Design, DesignElement, DeviceModel } from '@/types';
import { aabb, clearTextLayoutCache, corners, elementSize, hitElement, type Pt } from '@/lib/design/elements';
import type { ImageStore } from '@/lib/design/images';
import { imageDpi } from '@/lib/design/preflight';
import { cutoutPath, outlinePath, toCanvasPath } from '@/lib/design/path';
import { drawDesign } from '@/lib/design/render';

export interface CanvasHandle {
  fit: () => void;
  zoomBy: (f: number) => void;
}

interface Props {
  design: Design;
  model: DeviceModel;
  bleedMm: number;
  selectedId: string | null;
  images: ImageStore;
  mode: 'edit' | 'preview';
  showGuides: boolean;
  onSelect: (id: string | null) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  onPatch: (id: string, patch: Partial<DesignElement>) => void;
  onEditText: (id: string) => void;
  onDropFiles: (files: File[]) => void;
  onZoomChange?: (zoom: number) => void;
}

type Op =
  | { t: 'none' }
  | { t: 'move'; id: string; start: Pt; el: DesignElement; moved: boolean }
  | { t: 'resize'; id: string; anchor: Pt; startCorner: Pt; el: DesignElement }
  | { t: 'rotate'; id: string; center: Pt; startAngle: number; rot: number }
  | { t: 'pan'; sx: number; sy: number; px: number; py: number; moved: boolean }
  | { t: 'pinch-view'; d0: number; z0: number; mid0: Pt; pan0: Pt }
  | { t: 'pinch-el'; id: string; el: DesignElement; d0: number; a0: number; mid0: Pt };

const CUT_LABEL: Record<string, string> = {
  camera: 'فتحة الكاميرا',
  flash: 'الفلاش',
  fingerprint: 'البصمة',
  sensor: 'حساس',
  'logo-window': 'نافذة',
  speaker: 'سماعة',
};
const PAD = 26;
const PAD_TOP = 54; // مساحة لأزرار العرض العايمة

const CanvasView = forwardRef<CanvasHandle, Props>(function CanvasView(props, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  const view = useRef({ zoom: 1, panX: 0, panY: 0 });
  const size = useRef({ w: 300, h: 300, dpr: 1 });
  const pointers = useRef(new Map<number, Pt>());
  const op = useRef<Op>({ t: 'none' });
  const guides = useRef<{ x: number[]; y: number[] }>({ x: [], y: [] });
  const hud = useRef<string>('');
  const lastTap = useRef<{ id: string; at: number } | null>(null);
  const raf = useRef(0);
  const [dragOver, setDragOver] = useState(false);

  // ───── تحويلات الإحداثيات ─────
  const metrics = () => {
    const { model, bleedMm } = propsRef.current;
    const t = model.template;
    const totalW = t.widthMm + bleedMm * 2;
    const totalH = t.heightMm + bleedMm * 2;
    const availH = size.current.h - PAD_TOP - PAD;
    const fit = Math.max(0.5, Math.min((size.current.w - PAD * 2) / totalW, availH / totalH));
    const scale = fit * view.current.zoom;
    const cy = PAD_TOP + availH / 2;
    return { t, totalW, totalH, fit, scale, cy };
  };
  const w2s = (p: Pt): Pt => {
    const { t, scale, cy } = metrics();
    return {
      x: size.current.w / 2 + view.current.panX + (p.x - t.widthMm / 2) * scale,
      y: cy + view.current.panY + (p.y - t.heightMm / 2) * scale,
    };
  };
  const s2w = (p: Pt): Pt => {
    const { t, scale, cy } = metrics();
    return {
      x: (p.x - size.current.w / 2 - view.current.panX) / scale + t.widthMm / 2,
      y: (p.y - cy - view.current.panY) / scale + t.heightMm / 2,
    };
  };

  // ───── الرسم ─────
  const draw = useCallback(() => {
    raf.current = 0;
    const cv = canvasRef.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const { design, bleedMm, images, selectedId, mode, showGuides } = propsRef.current;
    const { t, totalW, totalH, scale, cy: centerY } = metrics();
    const { w, h, dpr } = size.current;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#E4DFD2';
    g.fillRect(0, 0, w, h);

    const ox = w / 2 + view.current.panX - (t.widthMm / 2) * scale;
    const oy = centerY + view.current.panY - (t.heightMm / 2) * scale;
    const world = () => {
      g.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
    };
    const px = 1 / scale; // بكسل شاشة بوحدة الملّيمتر
    const bleedArea = { x: -bleedMm, y: -bleedMm, w: totalW, h: totalH };
    const outline = toCanvasPath(outlinePath(t));
    const cutPaths = t.cutouts.map((c) => ({ c, p: toCanvasPath(cutoutPath(c)) }));

    if (mode === 'preview') {
      drawPreview(g, design, images, t, cutPaths, scale, world, dpr, ox, oy);
      return;
    }

    // الورقة (منطقة الـ bleed)
    world();
    g.save();
    g.shadowColor = 'rgba(29,27,23,0.22)';
    g.shadowBlur = 18 * dpr;
    g.shadowOffsetY = 4 * dpr;
    g.fillStyle = '#fff';
    g.fillRect(bleedArea.x, bleedArea.y, bleedArea.w, bleedArea.h);
    g.restore();
    if (design.background.type === 'transparent') {
      g.save();
      g.beginPath();
      g.rect(bleedArea.x, bleedArea.y, bleedArea.w, bleedArea.h);
      g.clip();
      g.fillStyle = '#fff';
      g.fillRect(bleedArea.x, bleedArea.y, bleedArea.w, bleedArea.h);
      g.fillStyle = '#ddd8ca';
      const cs = 3;
      for (let yy = Math.floor(bleedArea.y / cs); yy * cs < bleedArea.y + bleedArea.h; yy++)
        for (let xx = Math.floor(bleedArea.x / cs); xx * cs < bleedArea.x + bleedArea.w; xx++)
          if ((xx + yy) & 1) g.fillRect(xx * cs, yy * cs, cs, cs);
      g.restore();
    }
    drawDesign(g, design, images, bleedArea, scale * dpr);

    // تعتيم الـ bleed (الجزء اللي هيتقص)
    g.save();
    const dim = new Path2D();
    dim.rect(bleedArea.x, bleedArea.y, bleedArea.w, bleedArea.h);
    dim.addPath(outline);
    g.fillStyle = 'rgba(29,27,23,0.34)';
    g.fill(dim, 'evenodd');
    g.restore();

    // الفتحات
    for (const { c, p } of cutPaths) {
      g.save();
      g.fillStyle = 'rgba(214,69,31,0.16)';
      g.fill(p);
      g.clip(p);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.strokeStyle = 'rgba(214,69,31,0.55)';
      g.lineWidth = 1;
      const bx = ox + c.xMm * scale;
      const by = oy + c.yMm * scale;
      const bw = c.widthMm * scale;
      const bh = c.heightMm * scale;
      g.beginPath();
      for (let k = -bh; k < bw; k += 9) {
        g.moveTo(bx + k, by + bh);
        g.lineTo(bx + k + bh, by);
      }
      g.stroke();
      g.restore();
      world();
      g.lineWidth = 1.4 * px;
      g.strokeStyle = '#D6451F';
      g.stroke(p);
    }

    // خط القص + الأمان
    g.lineWidth = 1.3 * px;
    g.strokeStyle = '#EC008C';
    g.stroke(outline);
    if (showGuides) {
      g.save();
      g.setLineDash([5 * px, 4 * px]);
      g.lineWidth = 1 * px;
      g.strokeStyle = '#1b9aaa';
      const s = t.safeMarginMm;
      g.strokeRect(s, s, t.widthMm - s * 2, t.heightMm - s * 2);
      g.setLineDash([2 * px, 3 * px]);
      g.strokeStyle = 'rgba(29,27,23,0.45)';
      g.strokeRect(bleedArea.x, bleedArea.y, bleedArea.w, bleedArea.h);
      g.restore();

      // الأبعاد
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#55514A';
      g.font = '500 11px "IBM Plex Sans Arabic", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'bottom';
      g.direction = 'ltr';
      const top = oy - bleedMm * scale - 6;
      if (top > 12) g.fillText(`${t.widthMm} mm`, ox + (t.widthMm / 2) * scale, top);
      const left = ox - bleedMm * scale - 8;
      if (left > 14) {
        g.save();
        g.translate(left, oy + (t.heightMm / 2) * scale);
        g.rotate(-Math.PI / 2);
        g.fillText(`${t.heightMm} mm`, 0, 0);
        g.restore();
      }
    }

    // تسميات الفتحات
    if (showGuides) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.font = '600 10.5px "IBM Plex Sans Arabic", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.direction = 'rtl';
      for (const { c } of cutPaths) {
        const cw = c.widthMm * scale;
        if (cw < 46) continue;
        const cx = ox + (c.xMm + c.widthMm / 2) * scale;
        const cy = oy + (c.yMm + c.heightMm / 2) * scale;
        const label = CUT_LABEL[c.type] ?? 'فتحة';
        const tw = g.measureText(label).width + 12;
        g.fillStyle = 'rgba(255,255,255,0.92)';
        roundRect(g, cx - tw / 2, cy - 10, tw, 20, 6);
        g.fill();
        g.fillStyle = '#B83A19';
        g.fillText(label, cx, cy + 0.5);
      }
    }

    // دلائل المحاذاة
    if (guides.current.x.length || guides.current.y.length) {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.strokeStyle = '#D6451F';
      g.lineWidth = 1;
      g.setLineDash([4, 3]);
      g.beginPath();
      for (const gx of guides.current.x) {
        const sx = ox + gx * scale;
        g.moveTo(sx, oy - bleedMm * scale - 8);
        g.lineTo(sx, oy + (t.heightMm + bleedMm) * scale + 8);
      }
      for (const gy of guides.current.y) {
        const sy = oy + gy * scale;
        g.moveTo(ox - bleedMm * scale - 8, sy);
        g.lineTo(ox + (t.widthMm + bleedMm) * scale + 8, sy);
      }
      g.stroke();
      g.setLineDash([]);
    }

    // التحديد
    const sel = design.elements.find((e) => e.id === selectedId && !e.hidden);
    if (sel) drawSelection(g, sel, w2s, dpr, op.current.t === 'none' || op.current.t === 'move' ? 'idle' : 'active', hud.current);
  }, []);

  const schedule = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(draw);
  }, [draw]);

  // إعادة الرسم لما أي حاجة تتغير
  useEffect(() => {
    schedule();
  }, [props.design, props.selectedId, props.mode, props.showGuides, props.model, props.bleedMm, schedule]);

  // أول ما تتحمل صورة أو خط
  useEffect(() => {
    const store = props.images;
    store.onLoad = schedule;
    const onFonts = () => {
      clearTextLayoutCache();
      schedule();
    };
    document.fonts?.addEventListener?.('loadingdone', onFonts);
    return () => {
      store.onLoad = undefined;
      document.fonts?.removeEventListener?.('loadingdone', onFonts);
    };
  }, [props.images, schedule]);

  // حجم الحاوية
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      size.current = { w: Math.max(50, r.width), h: Math.max(50, r.height), dpr };
      const cv = canvasRef.current!;
      cv.width = Math.round(size.current.w * dpr);
      cv.height = Math.round(size.current.h * dpr);
      cv.style.width = `${size.current.w}px`;
      cv.style.height = `${size.current.h}px`;
      schedule();
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [schedule]);

  // لما الموديل أو الـ bleed يتغير نرجع للمقاس الكامل
  useEffect(() => {
    view.current = { zoom: 1, panX: 0, panY: 0 };
    props.onZoomChange?.(1);
    schedule();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.model.id, props.bleedMm]);

  const setZoom = useCallback(
    (z: number, about?: Pt) => {
      const v = view.current;
      const nz = Math.min(8, Math.max(0.5, z));
      if (about) {
        const k = nz / v.zoom;
        const cx = size.current.w / 2;
        const cy = metrics().cy;
        v.panX = about.x - cx - (about.x - cx - v.panX) * k;
        v.panY = about.y - cy - (about.y - cy - v.panY) * k;
      } else {
        v.panX *= nz / v.zoom;
        v.panY *= nz / v.zoom;
      }
      v.zoom = nz;
      if (nz <= 1.001) {
        v.panX = 0;
        v.panY = 0;
      }
      propsRef.current.onZoomChange?.(nz);
      schedule();
    },
    [schedule]
  );

  useImperativeHandle(
    ref,
    () => ({
      fit: () => {
        view.current = { zoom: 1, panX: 0, panY: 0 };
        propsRef.current.onZoomChange?.(1);
        schedule();
      },
      zoomBy: (f: number) => setZoom(view.current.zoom * f),
    }),
    [schedule, setZoom]
  );

  // ───── التفاعل ─────
  const local = (e: { clientX: number; clientY: number }): Pt => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const hitHandle = (el: DesignElement, s: Pt, touch: boolean): 'rotate' | number | null => {
    const r = touch ? 22 : 12;
    const cs = corners(el).map(w2s);
    const rot = rotateHandlePos(el, w2s);
    if (Math.hypot(s.x - rot.x, s.y - rot.y) <= r) return 'rotate';
    for (let i = 0; i < 4; i++) if (Math.hypot(s.x - cs[i].x, s.y - cs[i].y) <= r) return i;
    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const p = propsRef.current;
    canvasRef.current?.setPointerCapture(e.pointerId);
    const s = local(e);
    pointers.current.set(e.pointerId, s);
    const touch = e.pointerType !== 'mouse';

    if (pointers.current.size === 2) {
      // لمستين: تكبير/تدوير
      endOp();
      const [a, b] = [...pointers.current.values()];
      const d0 = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid0 = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const sel = p.design.elements.find((x) => x.id === p.selectedId);
      if (p.mode === 'edit' && sel && !sel.locked && !sel.hidden) {
        p.onGestureStart();
        op.current = { t: 'pinch-el', id: sel.id, el: sel, d0, a0: Math.atan2(b.y - a.y, b.x - a.x), mid0 };
      } else {
        op.current = { t: 'pinch-view', d0, z0: view.current.zoom, mid0, pan0: { x: view.current.panX, y: view.current.panY } };
      }
      return;
    }
    if (pointers.current.size > 2) return;

    if (p.mode === 'preview') {
      op.current = { t: 'pan', sx: s.x, sy: s.y, px: view.current.panX, py: view.current.panY, moved: false };
      return;
    }

    const sel = p.design.elements.find((x) => x.id === p.selectedId && !x.hidden);
    if (sel && !sel.locked) {
      const h = hitHandle(sel, s, touch);
      if (h !== null) {
        p.onGestureStart();
        if (h === 'rotate') {
          const c = w2s({ x: sel.x, y: sel.y });
          op.current = { t: 'rotate', id: sel.id, center: c, startAngle: Math.atan2(s.y - c.y, s.x - c.x), rot: sel.rotation };
        } else {
          const cs = corners(sel);
          op.current = { t: 'resize', id: sel.id, anchor: cs[(h + 2) % 4], startCorner: cs[h], el: sel };
        }
        schedule();
        return;
      }
    }

    const w = s2w(s);
    const tol = (touch ? 10 : 5) / metrics().scale;
    for (let i = p.design.elements.length - 1; i >= 0; i--) {
      const el = p.design.elements[i];
      if (el.hidden || el.locked) continue;
      if (hitElement(el, w, tol)) {
        if (p.selectedId !== el.id) p.onSelect(el.id);
        p.onGestureStart();
        op.current = { t: 'move', id: el.id, start: w, el, moved: false };
        return;
      }
    }
    op.current = { t: 'pan', sx: s.x, sy: s.y, px: view.current.panX, py: view.current.panY, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const p = propsRef.current;
    const s = local(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, s);
    const o = op.current;
    if (o.t === 'none') return;

    if (o.t === 'pinch-view' || o.t === 'pinch-el') {
      if (pointers.current.size < 2) return;
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (o.t === 'pinch-view') {
        const v = view.current;
        const nz = Math.min(8, Math.max(0.5, (o.z0 * d) / o.d0));
        const k = nz / o.z0;
        const cx = size.current.w / 2;
        const cy = metrics().cy;
        v.zoom = nz;
        v.panX = mid.x - cx - (o.mid0.x - cx - o.pan0.x) * k;
        v.panY = mid.y - cy - (o.mid0.y - cy - o.pan0.y) * k;
        if (nz <= 1.001) {
          v.panX = 0;
          v.panY = 0;
        }
        p.onZoomChange?.(nz);
      } else {
        const k = d / o.d0;
        const ang = Math.atan2(b.y - a.y, b.x - a.x) - o.a0;
        const sc = metrics().scale;
        const patch = scaled(o.el, k);
        patch.rotation = normAngle(o.el.rotation + (ang * 180) / Math.PI);
        patch.x = o.el.x + (mid.x - o.mid0.x) / sc;
        patch.y = o.el.y + (mid.y - o.mid0.y) / sc;
        p.onPatch(o.id, patch);
        hud.current = hudText(o.el, patch);
      }
      schedule();
      return;
    }

    if (o.t === 'pan') {
      const dx = s.x - o.sx;
      const dy = s.y - o.sy;
      if (!o.moved && Math.hypot(dx, dy) > 4) o.moved = true;
      if (o.moved && view.current.zoom > 1.001) {
        view.current.panX = o.px + dx;
        view.current.panY = o.py + dy;
        schedule();
      }
      return;
    }

    if (o.t === 'move') {
      const w = s2w(s);
      let dx = w.x - o.start.x;
      let dy = w.y - o.start.y;
      if (!o.moved && Math.hypot(dx, dy) * metrics().scale < 3) return;
      o.moved = true;
      // محاذاة مغناطيسية مع المنتصف والحواف
      const t = p.model.template;
      const probe = { ...o.el, x: o.el.x + dx, y: o.el.y + dy } as DesignElement;
      const bb = aabb(probe);
      const thr = 6 / metrics().scale;
      const xs = [-p.bleedMm, 0, t.widthMm / 2, t.widthMm, t.widthMm + p.bleedMm];
      const ys = [-p.bleedMm, 0, t.heightMm / 2, t.heightMm, t.heightMm + p.bleedMm];
      const gx: number[] = [];
      const gy: number[] = [];
      const bestX = bestSnap([bb.x1, (bb.x1 + bb.x2) / 2, bb.x2], xs, thr);
      const bestY = bestSnap([bb.y1, (bb.y1 + bb.y2) / 2, bb.y2], ys, thr);
      if (bestX) {
        dx += bestX.delta;
        gx.push(bestX.line);
      }
      if (bestY) {
        dy += bestY.delta;
        gy.push(bestY.line);
      }
      guides.current = { x: gx, y: gy };
      p.onPatch(o.id, { x: o.el.x + dx, y: o.el.y + dy });
      schedule();
      return;
    }

    if (o.t === 'resize') {
      const w = s2w(s);
      const d = { x: o.startCorner.x - o.anchor.x, y: o.startCorner.y - o.anchor.y };
      const len2 = d.x * d.x + d.y * d.y || 1;
      let k = ((w.x - o.anchor.x) * d.x + (w.y - o.anchor.y) * d.y) / len2;
      k = Math.max(0.05, k);
      const patch = scaled(o.el, k);
      patch.x = o.anchor.x + (o.el.x - o.anchor.x) * k;
      patch.y = o.anchor.y + (o.el.y - o.anchor.y) * k;
      p.onPatch(o.id, patch);
      hud.current = hudText(o.el, patch);
      schedule();
      return;
    }

    if (o.t === 'rotate') {
      const a = Math.atan2(s.y - o.center.y, s.x - o.center.x);
      let deg = o.rot + ((a - o.startAngle) * 180) / Math.PI;
      deg = normAngle(deg);
      const snap = Math.round(deg / 45) * 45;
      if (Math.abs(deg - snap) < 3) deg = snap;
      p.onPatch(o.id, { rotation: deg });
      hud.current = `${Math.round(deg)}°`;
      schedule();
    }
  };

  const endOp = () => {
    const o = op.current;
    const p = propsRef.current;
    if (o.t === 'move' || o.t === 'resize' || o.t === 'rotate' || o.t === 'pinch-el') p.onGestureEnd();
    guides.current = { x: [], y: [] };
    hud.current = '';
    op.current = { t: 'none' };
    schedule();
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const p = propsRef.current;
    const o = op.current;
    const wasPinch = o.t === 'pinch-view' || o.t === 'pinch-el';
    pointers.current.delete(e.pointerId);
    if (wasPinch) {
      if (pointers.current.size < 2) endOp();
      return;
    }
    if (o.t === 'pan' && !o.moved && p.mode === 'edit') p.onSelect(null);
    if (o.t === 'move' && !o.moved) {
      // نقرتين على النص = تعديل
      const now = Date.now();
      const el = p.design.elements.find((x) => x.id === o.id);
      if (el?.kind === 'text' && lastTap.current && lastTap.current.id === el.id && now - lastTap.current.at < 380) {
        p.onEditText(el.id);
        lastTap.current = null;
      } else {
        lastTap.current = { id: o.id, at: now };
      }
    }
    endOp();
  };

  // عجلة الماوس: Ctrl = تكبير، بدون Ctrl = تحريك لو متكبّر
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const at = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (e.ctrlKey || e.metaKey) {
        setZoom(view.current.zoom * Math.exp(-e.deltaY * 0.01), at);
      } else if (view.current.zoom > 1.001) {
        view.current.panX -= e.shiftKey ? e.deltaY : e.deltaX;
        view.current.panY -= e.shiftKey ? 0 : e.deltaY;
        schedule();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setZoom, schedule]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'));
    if (files.length) props.onDropFiles(files);
  };

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full overflow-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <canvas
        ref={canvasRef}
        className="block touch-none select-none"
        style={{ cursor: props.mode === 'preview' ? 'grab' : 'default' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      {dragOver && (
        <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-2xl border-2 border-dashed border-accent bg-accent-soft/70 text-lg font-bold text-accent">
          سيب الصورة هنا
        </div>
      )}
    </div>
  );
});

export default memo(CanvasView);

// ───────── أدوات مساعدة ─────────

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const normAngle = (d: number) => {
  let a = ((((d + 180) % 360) + 360) % 360) - 180;
  if (a === -180) a = 180;
  return a;
};

function bestSnap(values: number[], lines: number[], thr: number): { delta: number; line: number } | null {
  let best: { delta: number; line: number } | null = null;
  for (const v of values)
    for (const l of lines) {
      const d = l - v;
      if (Math.abs(d) <= thr && (!best || Math.abs(d) < Math.abs(best.delta))) best = { delta: d, line: l };
    }
  return best;
}

function scaled(el: DesignElement, k: number): Partial<DesignElement> {
  if (el.kind === 'text') return { fontSize: Math.max(1, Math.min(300, el.fontSize * k)) } as Partial<DesignElement>;
  return { w: Math.max(2, el.w * k), h: Math.max(2, el.h * k) } as Partial<DesignElement>;
}

function hudText(el: DesignElement, patch: Partial<DesignElement>): string {
  const merged = { ...el, ...patch } as DesignElement;
  const { w, h } = elementSize(merged);
  let s = `${w.toFixed(1)} × ${h.toFixed(1)} mm`;
  if (merged.kind === 'image') s += `  ·  ${imageDpi(merged)} DPI`;
  return s;
}

function rotateHandlePos(el: DesignElement, w2s: (p: Pt) => Pt): Pt {
  const cs = corners(el).map(w2s);
  const topMid = { x: (cs[0].x + cs[1].x) / 2, y: (cs[0].y + cs[1].y) / 2 };
  const center = { x: (cs[0].x + cs[2].x) / 2, y: (cs[0].y + cs[2].y) / 2 };
  const dx = topMid.x - center.x;
  const dy = topMid.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: topMid.x + (dx / len) * 30, y: topMid.y + (dy / len) * 30 };
}

function drawSelection(
  g: CanvasRenderingContext2D,
  el: DesignElement,
  w2s: (p: Pt) => Pt,
  dpr: number,
  state: 'idle' | 'active',
  hud: string
) {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cs = corners(el).map(w2s);
  g.lineWidth = 1.5;
  g.strokeStyle = el.locked ? '#8A857A' : '#1D1B17';
  g.setLineDash(el.locked ? [4, 3] : []);
  g.beginPath();
  g.moveTo(cs[0].x, cs[0].y);
  for (let i = 1; i < 4; i++) g.lineTo(cs[i].x, cs[i].y);
  g.closePath();
  g.stroke();
  g.setLineDash([]);
  if (el.locked) return;

  const rot = rotateHandlePos(el, w2s);
  const topMid = { x: (cs[0].x + cs[1].x) / 2, y: (cs[0].y + cs[1].y) / 2 };
  g.beginPath();
  g.moveTo(topMid.x, topMid.y);
  g.lineTo(rot.x, rot.y);
  g.stroke();
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(rot.x, rot.y, 8, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // أيقونة دوران صغيرة
  g.beginPath();
  g.arc(rot.x, rot.y, 3.2, -Math.PI * 0.2, Math.PI * 1.3);
  g.stroke();

  for (const c of cs) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.rect(c.x - 6, c.y - 6, 12, 12);
    g.fill();
    g.stroke();
  }

  if (hud && state === 'active') {
    g.font = '600 12px "IBM Plex Sans Arabic", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.direction = 'ltr';
    const tw = g.measureText(hud).width + 16;
    const bx = (cs[2].x + cs[3].x) / 2;
    const by = Math.max(cs[2].y, cs[3].y) + 26;
    g.fillStyle = '#1D1B17';
    roundRect(g, bx - tw / 2, by - 11, tw, 22, 7);
    g.fill();
    g.fillStyle = '#fff';
    g.fillText(hud, bx, by + 0.5);
  }
}

function drawPreview(
  g: CanvasRenderingContext2D,
  design: Design,
  images: ImageStore,
  t: DeviceModel['template'],
  cutPaths: { c: DeviceModel['template']['cutouts'][number]; p: Path2D }[],
  scale: number,
  world: () => void,
  dpr: number,
  ox: number,
  oy: number
) {
  const outline = toCanvasPath(outlinePath(t));
  const body = new Path2D();
  body.addPath(outline);
  for (const { p } of cutPaths) body.addPath(p);

  // ظل الجراب
  world();
  g.save();
  g.shadowColor = 'rgba(29,27,23,0.35)';
  g.shadowBlur = 28 * dpr;
  g.shadowOffsetY = 10 * dpr;
  g.fillStyle = '#fff';
  g.fill(body, 'evenodd');
  g.restore();

  // التصميم داخل شكل الجراب
  g.save();
  g.clip(body, 'evenodd');
  g.fillStyle = '#f5f3ee';
  g.fillRect(-2, -2, t.widthMm + 4, t.heightMm + 4);
  drawDesign(g, design, images, { x: -3, y: -3, w: t.widthMm + 6, h: t.heightMm + 6 }, scale * dpr);
  // لمعة خفيفة
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const gl = g.createLinearGradient(ox, oy, ox + t.widthMm * scale, oy + t.heightMm * scale * 0.7);
  gl.addColorStop(0, 'rgba(255,255,255,0.20)');
  gl.addColorStop(0.45, 'rgba(255,255,255,0)');
  gl.addColorStop(1, 'rgba(0,0,0,0.10)');
  g.fillStyle = gl;
  g.fillRect(ox, oy, t.widthMm * scale, t.heightMm * scale);
  g.restore();

  // الفتحات (ظاهر منها الموبايل)
  world();
  for (const { c, p } of cutPaths) {
    g.save();
    g.clip(p);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const gr = g.createLinearGradient(
      ox + c.xMm * scale,
      oy + c.yMm * scale,
      ox + (c.xMm + c.widthMm) * scale,
      oy + (c.yMm + c.heightMm) * scale
    );
    gr.addColorStop(0, '#26262c');
    gr.addColorStop(1, '#0d0d10');
    g.fillStyle = gr;
    g.fillRect(ox + c.xMm * scale - 2, oy + c.yMm * scale - 2, c.widthMm * scale + 4, c.heightMm * scale + 4);
    g.restore();
    world();
    g.lineWidth = 0.5;
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.stroke(p);
  }
  g.lineWidth = 0.35;
  g.strokeStyle = 'rgba(29,27,23,0.35)';
  g.stroke(outline);
}
