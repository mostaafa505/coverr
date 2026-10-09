import { Cutout, PrintTemplate, CutoutType, CutoutShape } from '@/types';

export interface SvgParseResult {
  success: boolean;
  template?: PrintTemplate;
  detectedCutoutsCount: number;
  originalDimensions?: {
    width: number;
    height: number;
    unit: string;
  };
  warnings: string[];
  rawSvg?: string;
}

/**
 * Parses supplier SVG die-line files and converts them into millimeter-based print templates
 */
export function parseSvgDieline(svgContent: string): SvgParseResult {
  const warnings: string[] = [];

  try {
    // 1. Extract width, height and viewBox from root <svg> tag
    const svgTagMatch = svgContent.match(/<svg\b([^>]*)>/i);
    if (!svgTagMatch) {
      return { success: false, detectedCutoutsCount: 0, warnings: ['الملف ليس ملف SVG صالحاً.'] };
    }

    const svgAttrs = svgTagMatch[1];
    const widthMatch = svgAttrs.match(/width\s*=\s*["']([^"']+)["']/i);
    const heightMatch = svgAttrs.match(/height\s*=\s*["']([^"']+)["']/i);
    const viewBoxMatch = svgAttrs.match(/viewBox\s*=\s*["']([^"']+)["']/i);

    let rawW = 0;
    let rawH = 0;
    let unit = 'px';
    let pxToMm = 25.4 / 96; // Default assuming 96 DPI CSS pixels

    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4) {
        rawW = parts[2];
        rawH = parts[3];
      }
    }

    if (widthMatch && heightMatch) {
      const wStr = widthMatch[1];
      const hStr = heightMatch[1];

      if (wStr.endsWith('mm')) {
        rawW = parseFloat(wStr);
        rawH = parseFloat(hStr);
        unit = 'mm';
        pxToMm = 1;
      } else if (wStr.endsWith('pt')) {
        rawW = parseFloat(wStr);
        rawH = parseFloat(hStr);
        unit = 'pt';
        pxToMm = 25.4 / 72; // 72 pt per inch
      } else if (wStr.endsWith('in')) {
        rawW = parseFloat(wStr);
        rawH = parseFloat(hStr);
        unit = 'in';
        pxToMm = 25.4;
      } else {
        const valW = parseFloat(wStr);
        const valH = parseFloat(hStr);
        if (valW > 0) rawW = valW;
        if (valH > 0) rawH = valH;
      }
    }

    // Typical phone case width is between 60mm and 95mm, height between 130mm and 180mm
    // Let's calibrate if unit was unstated or in pixels
    let widthMm = rawW * pxToMm;
    let heightMm = rawH * pxToMm;

    // Auto-calibration heuristic if scale seems off
    if (widthMm > 300 || heightMm > 400) {
      // Might be pt or 300 DPI pixels
      const testDpi300 = rawW * (25.4 / 300);
      if (testDpi300 >= 60 && testDpi300 <= 100) {
        pxToMm = 25.4 / 300;
        widthMm = rawW * pxToMm;
        heightMm = rawH * pxToMm;
        warnings.push('تمت معايرة المقياس تلقائياً بالاعتماد على دقة 300 DPI.');
      }
    } else if (widthMm < 30) {
      // Might be centimeters (e.g. 7.5cm)
      if (widthMm * 10 >= 60 && widthMm * 10 <= 100) {
        pxToMm = 10;
        widthMm = rawW * pxToMm;
        heightMm = rawH * pxToMm;
        warnings.push('تم استنتاج القياس بالسنتيمتر وتحويله إلى الملليمتر.');
      }
    }

    // Default fallbacks if no dimension attributes found
    if (!widthMm || !heightMm || widthMm <= 0 || heightMm <= 0) {
      widthMm = 76.0;
      heightMm = 160.0;
      warnings.push('لم يتم العثور على أبعاد دقيقة في رأس ملف SVG، يرجى مراجعة الأبعاد وتعديلها يدوياً.');
    }

    const cutouts: Cutout[] = [];
    let cutoutIdx = 1;

    // 2. Parse <rect> elements
    const rectRegex = /<rect\b([^>]+)>/gi;
    let rectMatch;
    while ((rectMatch = rectRegex.exec(svgContent)) !== null) {
      const attrs = rectMatch[1];
      const x = getAttr(attrs, 'x') * pxToMm;
      const y = getAttr(attrs, 'y') * pxToMm;
      const w = getAttr(attrs, 'width') * pxToMm;
      const h = getAttr(attrs, 'height') * pxToMm;
      const rx = (getAttr(attrs, 'rx') || getAttr(attrs, 'ry') || 0) * pxToMm;

      // Skip the outermost boundary if it matches the total dimensions
      if (Math.abs(w - widthMm) < 2 && Math.abs(h - heightMm) < 2) {
        continue;
      }

      if (w > 2 && h > 2) {
        const type = guessCutoutType(x, y, w, h, widthMm, heightMm);
        cutouts.push({
          id: `cutout-${cutoutIdx++}`,
          name: `فتحة ${cutoutIdx - 1} (${type === 'camera' ? 'كاميرا' : 'فتحة'})`,
          type,
          shape: rx > 0 ? 'rounded-rect' : 'rect',
          xMm: Number(x.toFixed(2)),
          yMm: Number(y.toFixed(2)),
          widthMm: Number(w.toFixed(2)),
          heightMm: Number(h.toFixed(2)),
          radiusMm: rx > 0 ? Number(rx.toFixed(2)) : undefined,
        });
      }
    }

    // 3. Parse <circle> elements
    const circleRegex = /<circle\b([^>]+)>/gi;
    let circleMatch;
    while ((circleMatch = circleRegex.exec(svgContent)) !== null) {
      const attrs = circleMatch[1];
      const cx = getAttr(attrs, 'cx') * pxToMm;
      const cy = getAttr(attrs, 'cy') * pxToMm;
      const r = getAttr(attrs, 'r') * pxToMm;

      if (r > 1) {
        const x = cx - r;
        const y = cy - r;
        const diam = r * 2;
        const type = guessCutoutType(x, y, diam, diam, widthMm, heightMm);
        cutouts.push({
          id: `cutout-${cutoutIdx++}`,
          name: `فتحة دائرية ${cutoutIdx - 1} (${type === 'flash' ? 'فلاش' : type === 'camera' ? 'عدسة' : 'مستشعر'})`,
          type,
          shape: 'circle',
          xMm: Number(x.toFixed(2)),
          yMm: Number(y.toFixed(2)),
          widthMm: Number(diam.toFixed(2)),
          heightMm: Number(diam.toFixed(2)),
          radiusMm: Number(r.toFixed(2)),
        });
      }
    }

    // 4. Parse simple path bounding boxes or path data if present
    const pathRegex = /<path\b([^>]+)>/gi;
    let pathMatch;
    while ((pathMatch = pathRegex.exec(svgContent)) !== null) {
      const attrs = pathMatch[1];
      const dMatch = attrs.match(/d\s*=\s*["']([^"']+)["']/i);
      if (dMatch) {
        const d = dMatch[1];
        // If path has bounding box data in id or data attributes
        const dataX = getAttr(attrs, 'data-x');
        const dataY = getAttr(attrs, 'data-y');
        const dataW = getAttr(attrs, 'data-width');
        const dataH = getAttr(attrs, 'data-height');

        if (dataW > 0 && dataH > 0) {
          cutouts.push({
            id: `cutout-${cutoutIdx++}`,
            name: `مسار قص منحني ${cutoutIdx - 1}`,
            type: 'camera',
            shape: 'path',
            xMm: Number((dataX * pxToMm).toFixed(2)),
            yMm: Number((dataY * pxToMm).toFixed(2)),
            widthMm: Number((dataW * pxToMm).toFixed(2)),
            heightMm: Number((dataH * pxToMm).toFixed(2)),
            svgPath: d,
          });
        }
      }
    }

    const template: PrintTemplate = {
      widthMm: Number(widthMm.toFixed(2)),
      heightMm: Number(heightMm.toFixed(2)),
      cornerRadiusMm: 6.0,
      bleedMm: 3.0,
      safeMarginMm: 3.0,
      cutouts,
      version: 1,
      lastUpdated: new Date().toISOString(),
    };

    return {
      success: true,
      template,
      detectedCutoutsCount: cutouts.length,
      originalDimensions: {
        width: Number(rawW.toFixed(2)),
        height: Number(rawH.toFixed(2)),
        unit,
      },
      warnings,
      rawSvg: svgContent,
    };
  } catch (err: any) {
    return {
      success: false,
      detectedCutoutsCount: 0,
      warnings: [`حدث خطأ أثناء معالجة ملف SVG: ${err.message}`],
    };
  }
}

function getAttr(attrStr: string, name: string): number {
  const match = attrStr.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  if (!match) return 0;
  return parseFloat(match[1]) || 0;
}

function guessCutoutType(xMm: number, yMm: number, wMm: number, hMm: number, totalW: number, totalH: number): CutoutType {
  // Fingerprint sensor: usually center-back in older models
  if (Math.abs(xMm + wMm / 2 - totalW / 2) < 15 && yMm > 35 && yMm < 80 && wMm < 20 && hMm < 20) {
    return 'fingerprint';
  }

  // Small circle near camera island is usually flash or sensor
  if (wMm <= 8 && hMm <= 8 && yMm < 70) {
    return 'flash';
  }

  // Logo window
  if (Math.abs(xMm + wMm / 2 - totalW / 2) < 10 && yMm > 60 && yMm < 110) {
    return 'logo-window';
  }

  // Default in upper half is camera
  if (yMm < 80) {
    return 'camera';
  }

  return 'camera';
}
