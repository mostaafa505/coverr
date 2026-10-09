import { DesignData, DeviceModel, PreflightIssue, PreflightReport } from '@/types';

/**
 * Preflight verification engine:
 * Runs professional print-readiness checks before export.
 */
export function runPreflightCheck(design: DesignData, model: DeviceModel): PreflightReport {
  const issues: PreflightIssue[] = [];
  const template = model.template;

  if (!template) {
    issues.push({
      severity: 'error',
      code: 'DIMENSION_MISMATCH',
      title: 'Missing Template',
      titleAr: 'قالب الطباعة غير متوفر',
      description: 'The model has no valid print template defined.',
      descriptionAr: 'هذا الموديل لا يحتوي على قالب طباعة معتمد في النظام.',
    });
    return {
      passed: false,
      canExport: false,
      dpiCheck: { minDpiFound: 0, targetDpi: 300, status: 'fail' },
      bleedCheck: { hasBleed: false, bleedMm: 0, status: 'fail' },
      collisionCheck: { hasCollisions: false, collidingElementsCount: 0 },
      issues,
    };
  }

  const bleedMm = template.bleedMm || 3.0;
  const safeMarginMm = template.safeMarginMm || 3.0;
  const totalWidthMm = template.widthMm + bleedMm * 2;
  const totalHeightMm = template.heightMm + bleedMm * 2;
  const pxPerMm = design.pxPerMm || 10; // default canvas scale ratio
  const elements = Array.isArray(design.elements) ? design.elements : [];

  let minDpiFound = 9999;
  let hasImages = false;

  // 1. Check DPI of all images
  for (const el of elements) {
    if (el.type === 'image') {
      hasImages = true;
      // Calculate covered physical width in mm
      // el.scaleX * originalWidth is rendered px on canvas.
      // rendered mm = rendered px / pxPerMm
      const renderedWidthMm = (el.scaleX * el.originalWidth) / pxPerMm;
      const renderedHeightMm = (el.scaleY * el.originalHeight) / pxPerMm;

      // DPI = pixels / (mm / 25.4)
      const dpiX = el.originalWidth / (renderedWidthMm / 25.4);
      const dpiY = el.originalHeight / (renderedHeightMm / 25.4);
      const effectiveDpi = Math.round(Math.min(dpiX, dpiY));

      if (effectiveDpi < minDpiFound) {
        minDpiFound = effectiveDpi;
      }

      if (effectiveDpi < 200) {
        issues.push({
          severity: 'warning',
          code: 'LOW_DPI',
          title: `Low Image Resolution (${effectiveDpi} DPI)`,
          titleAr: `تنبيه: دقة الصورة منخفضة (${effectiveDpi} نقطة في البوصة)`,
          description: `Image DPI is ${effectiveDpi}, below print standard of 300 DPI. Printout will look soft/pixelated.`,
          descriptionAr: `دقة الصورة الحالية ${effectiveDpi} DPI، يفضل استخدام صورة أعلى جودة للحصول على وضوح فائق، ولكن يمكن طباعتها.`,
          elementId: el.id,
          details: { effectiveDpi, targetDpi: 300 },
        });
      } else if (effectiveDpi < 300) {
        issues.push({
          severity: 'warning',
          code: 'LOW_DPI',
          title: `Acceptable Image Resolution (${effectiveDpi} DPI)`,
          titleAr: `دقة الصورة متوسطة (${effectiveDpi} DPI)`,
          description: `Image DPI is ${effectiveDpi}, which is below optimal 300 DPI but printable.`,
          descriptionAr: `دقة الصورة ${effectiveDpi} DPI مقبولة ولكنها أقل من المستوى المثالي للوضوح الفائق (300 DPI).`,
          elementId: el.id,
          details: { effectiveDpi, targetDpi: 300 },
        });
      }
    }
  }

  if (!hasImages) {
    minDpiFound = 300; // Text/vector only designs are crisp at 300 DPI
  }

  // 2. Check Bleed coverage
  // Bleed area is the outer border of bleedMm width around the trim box
  // If there are no background elements covering the full canvas
  const canvasW = design.canvasWidthPx;
  const canvasH = design.canvasHeightPx;
  let coversFullBleed = false;

  if (design.backgroundColor && design.backgroundColor !== 'transparent') {
    coversFullBleed = true;
  } else {
    // Check if any element covers the full canvas width and height
    for (const el of elements) {
      if (el.type === 'image' || el.type === 'shape') {
        const elW = el.type === 'image' ? el.originalWidth * el.scaleX : (el as any).width * el.scaleX;
        const elH = el.type === 'image' ? el.originalHeight * el.scaleY : (el as any).height * el.scaleY;
        if (el.x <= 5 && el.y <= 5 && elW >= canvasW - 10 && elH >= canvasH - 10) {
          coversFullBleed = true;
          break;
        }
      }
    }
  }

  if (!coversFullBleed) {
    issues.push({
      severity: 'warning',
      code: 'BLEED_INCOMPLETE',
      title: 'Design does not fully cover bleed area',
      titleAr: 'التصميم لا يغطي مساحة الهامش (Bleed) بالكامل',
      description: `Please ensure your design extends 3mm beyond the phone edges to avoid unprinted white edges after cutting.`,
      descriptionAr: `يرجى مد خلفية التصميم إلى حافة الهامش الخارجي (${bleedMm} مم) لمنع ظهور حواف بيضاء غير مطبوعة عند قص الجراب في الماكينة.`,
    });
  }

  // 3. Check Cutout Collisions (Text or focal points falling under camera or cutouts)
  let collidingElementsCount = 0;

  for (const el of elements) {
    // Text elements should NEVER fall under camera cutouts
    if (el.type === 'text') {
      const elXMm = el.x / pxPerMm;
      const elYMm = el.y / pxPerMm;
      // Approximate text dimensions
      const textWidthMm = (el.text.length * (el.fontSize * 0.6)) / pxPerMm;
      const textHeightMm = (el.fontSize * 1.2) / pxPerMm;

      // Coordinate offset: The cutouts are defined relative to the trim edge (after bleed)
      // So cutout absolute X in full canvas = (cutout.xMm + bleedMm)
      // cutout absolute Y in full canvas = (cutout.yMm + bleedMm)
      for (const cutout of template.cutouts) {
        const cutoutAbsXMm = cutout.xMm + bleedMm;
        const cutoutAbsYMm = cutout.yMm + bleedMm;

        // Check AABB collision with 2mm safety padding
        const pad = 1.0;
        const overlap =
          elXMm < cutoutAbsXMm + cutout.widthMm + pad &&
          elXMm + textWidthMm > cutoutAbsXMm - pad &&
          elYMm < cutoutAbsYMm + cutout.heightMm + pad &&
          elYMm + textHeightMm > cutoutAbsYMm - pad;

        if (overlap) {
          collidingElementsCount++;
          issues.push({
            severity: 'warning',
            code: 'CUTOUT_COLLISION',
            title: `Text intersects ${cutout.name}`,
            titleAr: `النص يتداخل مع فتحة ${cutout.nameAr || cutout.name}`,
            description: `The text "${el.text.substring(0, 20)}" is placed directly over the ${cutout.name} and will be cut off!`,
            descriptionAr: `النص "${el.text.substring(0, 25)}" موضوع فوق فتحة ${cutout.nameAr || cutout.name} وسيتعرض للقص والحذف في الماكينة! يرجى تحريكه.`,
            elementId: el.id,
            details: { cutoutName: cutout.name, text: el.text },
          });
        }
      }

      // 4. Check Safe Zone boundaries for Text
      // Safe zone is: [bleedMm + safeMarginMm] to [totalWidthMm - bleedMm - safeMarginMm]
      const safeMinX = bleedMm + safeMarginMm;
      const safeMaxX = totalWidthMm - bleedMm - safeMarginMm;
      const safeMinY = bleedMm + safeMarginMm;
      const safeMaxY = totalHeightMm - bleedMm - safeMarginMm;

      if (
        elXMm < safeMinX ||
        elXMm + textWidthMm > safeMaxX ||
        elYMm < safeMinY ||
        elYMm + textHeightMm > safeMaxY
      ) {
        issues.push({
          severity: 'warning',
          code: 'OUTSIDE_SAFE_ZONE',
          title: `Text outside safe zone`,
          titleAr: `النص قريب جداً من حافة القص (خارج منطقة الأمان)`,
          description: `The text "${el.text.substring(0, 20)}" is too close to the edge (${safeMarginMm}mm safe zone). It might be trimmed.`,
          descriptionAr: `النص "${el.text.substring(0, 25)}" قريب جداً من حافة القطع. يرجى إبعاده مسافة ${safeMarginMm} مم إلى الداخل لتجنب قصه بالخطأ.`,
          elementId: el.id,
        });
      }
    }
  }

  const hasErrors = issues.some((i) => i.severity === 'error');
  const dpiStatus = minDpiFound >= 300 ? 'ok' : minDpiFound >= 200 ? 'warning' : 'fail';
  const bleedStatus = coversFullBleed ? 'ok' : 'fail';

  return {
    passed: !hasErrors,
    canExport: !hasErrors,
    dpiCheck: {
      minDpiFound: minDpiFound === 9999 ? 300 : minDpiFound,
      targetDpi: 300,
      status: dpiStatus,
    },
    bleedCheck: {
      hasBleed: coversFullBleed,
      bleedMm,
      status: bleedStatus,
    },
    collisionCheck: {
      hasCollisions: collidingElementsCount > 0,
      collidingElementsCount,
    },
    issues,
  };
}
