import type { Design, DeviceModel, ImageElement } from '@/types';
import { aabb, elementLabel } from './elements';

export type IssueLevel = 'error' | 'warn' | 'info';

export interface Issue {
  id: string;
  level: IssueLevel;
  code: 'LOW_DPI' | 'TEXT_ON_CUTOUT' | 'TEXT_NEAR_EDGE' | 'EMPTY' | 'TINY_TEXT' | 'OFF_CASE';
  title: string;
  detail: string;
  elementId?: string;
}

export interface PreflightReport {
  issues: Issue[];
  /** أقل دقة فعلية بين الصور (null لو مفيش صور) */
  minDpi: number | null;
  hasErrors: boolean;
}

const CUT_NAME: Record<string, string> = {
  camera: 'فتحة الكاميرا',
  flash: 'الفلاش',
  fingerprint: 'البصمة',
  sensor: 'الحساس',
  'logo-window': 'النافذة',
  speaker: 'السماعة',
};

export function imageDpi(el: ImageElement): number {
  const pxW = el.nw * el.crop.w;
  const pxH = el.nh * el.crop.h;
  return Math.round(Math.min(pxW / (el.w / 25.4), pxH / (el.h / 25.4)));
}

export function runPreflight(design: Design, model: DeviceModel, bleedMm: number): PreflightReport {
  const t = model.template;
  const issues: Issue[] = [];
  let minDpi: number | null = null;
  const els = design.elements.filter((e) => !e.hidden);

  if (
    els.length === 0 &&
    design.background.type !== 'gradient' &&
    (design.background.type === 'transparent' || design.background.color.toLowerCase() === '#ffffff')
  ) {
    issues.push({
      id: 'empty',
      level: 'error',
      code: 'EMPTY',
      title: 'التصميم فاضي',
      detail: 'ضيف صورة أو نص أو لون خلفية قبل التصدير.',
    });
  }

  const safe = t.safeMarginMm;

  for (const el of els) {
    if (el.kind === 'image') {
      const dpi = imageDpi(el);
      minDpi = minDpi === null ? dpi : Math.min(minDpi, dpi);
      if (dpi < 150) {
        issues.push({
          id: `dpi-${el.id}`,
          level: 'error',
          code: 'LOW_DPI',
          title: `${elementLabel(el)}: دقة ضعيفة (${dpi} DPI)`,
          detail: 'الصورة صغيرة على المقاس ده وهتطلع مشوشة في الطباعة. استخدم صورة أكبر أو صغّر مقاسها.',
          elementId: el.id,
        });
      } else if (dpi < 220) {
        issues.push({
          id: `dpi-${el.id}`,
          level: 'warn',
          code: 'LOW_DPI',
          title: `${elementLabel(el)}: الدقة متوسطة (${dpi} DPI)`,
          detail: 'مقبولة للطباعة، لكن التفاصيل الدقيقة ممكن تظهر ناعمة. المثالي 300 DPI.',
          elementId: el.id,
        });
      }
    }

    if (el.kind === 'text') {
      if (el.fontSize < 2.2) {
        issues.push({
          id: `tiny-${el.id}`,
          level: 'warn',
          code: 'TINY_TEXT',
          title: `"${elementLabel(el)}": الخط صغير جدًا`,
          detail: 'أقل من 2.2 مم وممكن ما يظهرش واضح بعد الطباعة.',
          elementId: el.id,
        });
      }
      const b = aabb(el);
      for (const c of t.cutouts) {
        const pad = 1;
        if (b.x1 < c.xMm + c.widthMm + pad && b.x2 > c.xMm - pad && b.y1 < c.yMm + c.heightMm + pad && b.y2 > c.yMm - pad) {
          issues.push({
            id: `cut-${el.id}-${c.id}`,
            level: 'warn',
            code: 'TEXT_ON_CUTOUT',
            title: `"${elementLabel(el)}" فوق ${CUT_NAME[c.type] ?? 'فتحة'}`,
            detail: 'الجزء ده هيتقص مع الفتحة. حرّك النص بعيد عنها.',
            elementId: el.id,
          });
          break;
        }
      }
      if (b.x1 < safe || b.y1 < safe || b.x2 > t.widthMm - safe || b.y2 > t.heightMm - safe) {
        issues.push({
          id: `edge-${el.id}`,
          level: 'warn',
          code: 'TEXT_NEAR_EDGE',
          title: `"${elementLabel(el)}" قريب من الحافة`,
          detail: `ابعده ${safe} مم على الأقل عن الحافة عشان ما يتقصش بالغلط.`,
          elementId: el.id,
        });
      }
    }

    const b = aabb(el);
    if (b.x2 < -bleedMm || b.y2 < -bleedMm || b.x1 > t.widthMm + bleedMm || b.y1 > t.heightMm + bleedMm) {
      issues.push({
        id: `off-${el.id}`,
        level: 'info',
        code: 'OFF_CASE',
        title: `${elementLabel(el)} خارج مساحة الطباعة`,
        detail: 'العنصر ده برّه الجراب تمامًا ومش هيظهر في الملف.',
        elementId: el.id,
      });
    }
  }

  return { issues, minDpi, hasErrors: issues.some((i) => i.level === 'error') };
}
