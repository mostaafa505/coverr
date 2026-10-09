// ───────── الكتالوج (مقاسات الموديلات بالملّيمتر) ─────────

export type OSType = 'android' | 'ios';

export interface Brand {
  id: string;
  name: string;
  nameAr: string;
  os: OSType;
  active?: boolean;
}

export type CutoutType = 'camera' | 'fingerprint' | 'flash' | 'sensor' | 'logo-window' | 'speaker';
export type CutoutShape = 'rect' | 'circle' | 'rounded-rect';

export interface Cutout {
  id: string;
  name: string;
  type: CutoutType;
  shape: CutoutShape;
  /** المسافة من الحافة اليسرى لخط القص */
  xMm: number;
  /** المسافة من الحافة العلوية لخط القص */
  yMm: number;
  widthMm: number;
  heightMm: number;
  radiusMm?: number;
}

export interface PrintTemplate {
  widthMm: number;
  heightMm: number;
  cornerRadiusMm: number;
  bleedMm: number;
  safeMarginMm: number;
  cutouts: Cutout[];
}

export interface DeviceModel {
  id: string;
  brandId: string;
  name: string;
  releaseYear: number;
  aliases: string[];
  template: PrintTemplate;
}

export interface Catalog {
  brands: Brand[];
  models: DeviceModel[];
}

// ───────── التصميم (كل الأبعاد بالملّيمتر، نقطة الأصل = الركن العلوي الأيسر لخط القص) ─────────

export type ElementKind = 'image' | 'text' | 'shape';

export interface BaseElement {
  id: string;
  kind: ElementKind;
  /** مركز العنصر */
  x: number;
  y: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
  hidden?: boolean;
}

export interface ImageAdjust {
  brightness: number; // -100 .. 100
  contrast: number; // -100 .. 100
  saturation: number; // -100 .. 100
  grayscale: boolean;
  sepia: number; // 0 .. 100
}

export interface ImageElement extends BaseElement {
  kind: 'image';
  /** رابط blob محلي */
  src: string;
  /** أبعاد الصورة الأصلية بالبكسل */
  nw: number;
  nh: number;
  /** الجزء الظاهر من الصورة (كنسبة من 0 إلى 1) */
  crop: { x: number; y: number; w: number; h: number };
  w: number;
  h: number;
  flipX: boolean;
  flipY: boolean;
  adjust: ImageAdjust;
  name?: string;
}

export interface TextElement extends BaseElement {
  kind: 'text';
  text: string;
  fontFamily: string;
  /** ارتفاع الخط بالملّيمتر */
  fontSize: number;
  fill: string;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  stroke: string;
  /** سُمك الإطار بالملّيمتر (0 = بدون) */
  strokeWidth: number;
  lineHeight: number;
}

export type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'heart' | 'star';

export interface ShapeElement extends BaseElement {
  kind: 'shape';
  shape: ShapeKind;
  w: number;
  h: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  radius: number;
}

export type DesignElement = ImageElement | TextElement | ShapeElement;

export type Background =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; from: string; to: string; angle: number }
  | { type: 'transparent' };

export interface Design {
  elements: DesignElement[];
  background: Background;
}

// ───────── خيارات التصدير ─────────

export type PrintTechnology = 'sublimation' | 'uv' | 'dtf';
export type CaseType = 'flat' | 'wrap3d';

export interface ExportOptions {
  technology: PrintTechnology;
  caseType: CaseType;
  /** قلب الصورة أفقيًا (ورق السبلميشن) */
  mirror: boolean;
  /** خط القص كلون خاص CutContour داخل الـ PDF */
  cutLineInPdf: boolean;
  /** علامات تسجيل لماكينات القص الضوئية */
  registrationMarks: boolean;
  /** طبقة حبر أبيض (UV) كملف منفصل */
  whiteInk: boolean;
  /** JPEG بجودة عالية بدل الضغط بدون فقد */
  smallFile: boolean;
  jobName: string;
}
