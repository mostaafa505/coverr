import type { Cutout, PrintTemplate } from '@/types';

/** مسار بسيط بوحدة الملّيمتر يُستخدم للشاشة وللـ SVG وللـ PDF بنفس الأرقام */
export type Seg = ['M', number, number] | ['L', number, number] | ['C', number, number, number, number, number, number] | ['Z'];

const K = 0.5522847498; // ثابت تقريب القوس بمنحنى بيزييه

export function roundedRect(x: number, y: number, w: number, h: number, r: number): Seg[] {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr < 0.01) return [['M', x, y], ['L', x + w, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
  const k = rr * K;
  return [
    ['M', x + rr, y],
    ['L', x + w - rr, y],
    ['C', x + w - rr + k, y, x + w, y + rr - k, x + w, y + rr],
    ['L', x + w, y + h - rr],
    ['C', x + w, y + h - rr + k, x + w - rr + k, y + h, x + w - rr, y + h],
    ['L', x + rr, y + h],
    ['C', x + rr - k, y + h, x, y + h - rr + k, x, y + h - rr],
    ['L', x, y + rr],
    ['C', x, y + rr - k, x + rr - k, y, x + rr, y],
    ['Z'],
  ];
}

export function ellipse(cx: number, cy: number, rx: number, ry: number): Seg[] {
  const kx = rx * K;
  const ky = ry * K;
  return [
    ['M', cx + rx, cy],
    ['C', cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry],
    ['C', cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy],
    ['C', cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry],
    ['C', cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy],
    ['Z'],
  ];
}

export function outlinePath(t: PrintTemplate): Seg[] {
  return roundedRect(0, 0, t.widthMm, t.heightMm, t.cornerRadiusMm);
}

export function cutoutPath(c: Cutout): Seg[] {
  if (c.shape === 'circle') {
    return ellipse(c.xMm + c.widthMm / 2, c.yMm + c.heightMm / 2, c.widthMm / 2, c.heightMm / 2);
  }
  const r = c.shape === 'rect' ? 0 : (c.radiusMm ?? Math.min(c.widthMm, c.heightMm) * 0.25);
  return roundedRect(c.xMm, c.yMm, c.widthMm, c.heightMm, r);
}

export function offsetPath(segs: Seg[], dx: number, dy: number): Seg[] {
  return segs.map((s) => {
    if (s[0] === 'Z') return s;
    if (s[0] === 'C') return ['C', s[1] + dx, s[2] + dy, s[3] + dx, s[4] + dy, s[5] + dx, s[6] + dy] as Seg;
    return [s[0], s[1] + dx, s[2] + dy] as Seg;
  });
}

export function mirrorPathX(segs: Seg[], width: number): Seg[] {
  return segs.map((s) => {
    if (s[0] === 'Z') return s;
    if (s[0] === 'C') return ['C', width - s[1], s[2], width - s[3], s[4], width - s[5], s[6]] as Seg;
    return [s[0], width - s[1], s[2]] as Seg;
  });
}

export function toCanvasPath(segs: Seg[], p: Path2D = new Path2D()): Path2D {
  for (const s of segs) {
    if (s[0] === 'M') p.moveTo(s[1], s[2]);
    else if (s[0] === 'L') p.lineTo(s[1], s[2]);
    else if (s[0] === 'C') p.bezierCurveTo(s[1], s[2], s[3], s[4], s[5], s[6]);
    else p.closePath();
  }
  return p;
}

const f = (n: number) => String(Math.round(n * 1000) / 1000);

export function toSvgD(segs: Seg[]): string {
  return segs
    .map((s) => {
      if (s[0] === 'Z') return 'Z';
      if (s[0] === 'C') return `C${f(s[1])} ${f(s[2])} ${f(s[3])} ${f(s[4])} ${f(s[5])} ${f(s[6])}`;
      return `${s[0]}${f(s[1])} ${f(s[2])}`;
    })
    .join(' ');
}

/** مسار الشكل الكلي لخط القص: الإطار الخارجي + الفتحات */
export function templatePaths(t: PrintTemplate): { outline: Seg[]; cutouts: { id: string; path: Seg[] }[] } {
  return { outline: outlinePath(t), cutouts: t.cutouts.map((c) => ({ id: c.id, path: cutoutPath(c) })) };
}

// أشكال العناصر (داخل صندوق w × h حول المركز)
export function shapePath(shape: string, w: number, h: number, radius: number): Seg[] {
  const x = -w / 2;
  const y = -h / 2;
  switch (shape) {
    case 'ellipse':
      return ellipse(0, 0, w / 2, h / 2);
    case 'triangle':
      return [['M', 0, y], ['L', x + w, y + h], ['L', x, y + h], ['Z']];
    case 'star': {
      const pts: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? 1 : 0.42;
        pts.push([Math.cos(a) * rr * (w / 2), Math.sin(a) * rr * (h / 2)]);
      }
      return [['M', pts[0][0], pts[0][1]], ...pts.slice(1).map((p) => ['L', p[0], p[1]] as Seg), ['Z']];
    }
    case 'heart': {
      const sx = w / 100;
      const sy = h / 90;
      const P = (px: number, py: number): [number, number] => [(px - 50) * sx, (py - 45) * sy];
      const a = P(50, 88);
      const c1 = P(10, 60);
      const c2 = P(0, 30);
      const b = P(22, 10);
      const c3 = P(36, -4);
      const c4 = P(50, 8);
      const m = P(50, 22);
      const c5 = P(50, 8);
      const c6 = P(64, -4);
      const d = P(78, 10);
      const c7 = P(100, 30);
      const c8 = P(90, 60);
      return [
        ['M', a[0], a[1]],
        ['C', c1[0], c1[1], c2[0], c2[1], b[0], b[1]],
        ['C', c3[0], c3[1], c4[0], c4[1], m[0], m[1]],
        ['C', c5[0], c5[1], c6[0], c6[1], d[0], d[1]],
        ['C', c7[0], c7[1], c8[0], c8[1], a[0], a[1]],
        ['Z'],
      ];
    }
    default:
      return roundedRect(x, y, w, h, radius);
  }
}
