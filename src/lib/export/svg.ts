import type { DeviceModel } from '@/types';
import { cutoutPath, outlinePath, toSvgD } from '@/lib/design/path';

/** ملف القص: مسارات متجهة بوحدة الملّيمتر الحقيقية (1 وحدة = 1 مم) */
export function buildCutSvg(model: DeviceModel, jobId: string, regMarks: boolean): string {
  const t = model.template;
  const m = 8;
  const W = t.widthMm + m * 2;
  const H = t.heightMm + m * 2;
  const stroke = 'fill="none" stroke="#EC008C" stroke-width="0.1"';
  const cut = t.cutouts.map((c) => `    <path id="${esc(c.id)}" d="${toSvgD(cutoutPath(c))}" ${stroke}/>`).join('\n');
  const reg = regMarks
    ? `  <g id="registration" fill="#000">
${[
  [-4, -4],
  [t.widthMm + 4, -4],
  [-4, t.heightMm + 4],
  [t.widthMm + 4, t.heightMm + 4],
]
  .map(([x, y]) => `    <circle cx="${x}" cy="${y}" r="1.6"/>`)
  .join('\n')}
  </g>
`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- ${esc(jobId)} | ${esc(model.name)} | ${t.widthMm} x ${t.heightMm} mm | 1 user unit = 1 mm -->
<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}mm" height="${n(H)}mm" viewBox="${-m} ${-m} ${n(W)} ${n(H)}">
  <g id="CutContour">
    <path id="outline" d="${toSvgD(outlinePath(t))}" ${stroke}/>
${cut}
  </g>
${reg}</svg>
`;
}

const n = (v: number) => String(Math.round(v * 1000) / 1000);
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/--/g, '- -');
