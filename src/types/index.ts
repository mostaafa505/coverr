export type OSType = 'android' | 'ios';

export interface Brand {
  id: string;
  name: string;
  nameAr: string;
  os: OSType;
  logo?: string;
  active: boolean;
}

export type CutoutType = 'camera' | 'fingerprint' | 'flash' | 'logo-window' | 'speaker' | 'sensor';
export type CutoutShape = 'rect' | 'circle' | 'rounded-rect' | 'path';

export interface Cutout {
  id: string;
  name: string;
  nameAr?: string;
  type: CutoutType;
  shape: CutoutShape;
  xMm: number;        // X coordinate from top-left of cutline in mm
  yMm: number;        // Y coordinate from top-left of cutline in mm
  widthMm: number;    // Width in mm
  heightMm: number;   // Height in mm
  radiusMm?: number;  // Corner radius (or circle radius) in mm
  svgPath?: string;   // Optional SVG path data for custom curved outlines
}

export interface PrintTemplate {
  widthMm: number;        // Total print area width in mm (including bleed or base)
  heightMm: number;       // Total print area height in mm (including bleed or base)
  cornerRadiusMm: number; // Case outer corner radius in mm
  bleedMm: number;        // Bleed margin in mm (default 3mm)
  safeMarginMm: number;   // Safe margin inside cutline in mm (default 3mm)
  cutouts: Cutout[];      // Array of cutout zones
  supplierCode?: string;  // Optional supplier/factory die-line SKU
  version?: number;
  lastUpdated?: string;
}

export type ModelStatus = 'active' | 'needs_template' | 'disabled';

export interface DeviceModel {
  id: string;
  brandId: string;
  name: string;
  releaseYear: number;
  aliases: string[];      // e.g. ["2312DRA50C", "Redmi Note 13 4G"]
  status: ModelStatus;    // If not 'active' or template is null, hidden from public users
  template?: PrintTemplate | null;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Canvas Design Elements
export type ElementType = 'image' | 'text' | 'shape';

export interface BaseElement {
  id: string;
  type: ElementType;
  x: number;          // Position relative to canvas (px or mm)
  y: number;
  rotation: number;   // in degrees
  scaleX: number;
  scaleY: number;
  opacity: number;
  zIndex: number;
  locked?: boolean;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;        // Data URL or remote URL
  originalWidth: number;   // Natural pixels width
  originalHeight: number;  // Natural pixels height
  currentDpi: number;      // Calculated DPI based on covered physical mm
  filters?: {
    brightness?: number;
    contrast?: number;
    grayscale?: boolean;
    sepia?: boolean;
    saturation?: number;
    blur?: number;
    flipX?: boolean;
    flipY?: boolean;
  };
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  align: 'left' | 'center' | 'right';
  bold?: boolean;
  italic?: boolean;
  stroke?: string;
  strokeWidth?: number;
}

export interface ShapeElement extends BaseElement {
  type: 'shape';
  shapeType: 'rect' | 'circle' | 'star' | 'heart';
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export type CanvasElement = ImageElement | TextElement | ShapeElement;

export interface DesignData {
  canvasWidthPx: number;
  canvasHeightPx: number;
  pxPerMm: number;
  elements: CanvasElement[];
  backgroundColor?: string;
}

// Preflight Check Results
export interface PreflightIssue {
  severity: 'error' | 'warning' | 'info';
  code: 'LOW_DPI' | 'CUTOUT_COLLISION' | 'BLEED_INCOMPLETE' | 'OUTSIDE_SAFE_ZONE' | 'DIMENSION_MISMATCH';
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  elementId?: string;
  details?: Record<string, any>;
}

export interface PreflightReport {
  passed: boolean;
  canExport: boolean;
  dpiCheck: {
    minDpiFound: number;
    targetDpi: number;
    status: 'ok' | 'warning' | 'fail';
  };
  bleedCheck: {
    hasBleed: boolean;
    bleedMm: number;
    status: 'ok' | 'fail';
  };
  collisionCheck: {
    hasCollisions: boolean;
    collidingElementsCount: number;
  };
  issues: PreflightIssue[];
}

export type PrintTechnology = 'sublimation' | 'uv' | 'dtf';
export type CaseType = '2d_flat' | '3d_wrap' | 'tpu_clear' | 'hard_pc';

export interface PrintOptions {
  technology: PrintTechnology;             // 'sublimation' | 'uv' | 'dtf'
  caseType: CaseType;                     // '2d_flat' | '3d_wrap' | 'tpu_clear' | 'hard_pc'
  mirrorForSublimation?: boolean;         // Mirror flip horizontally
  generateWhiteUnderbase?: boolean;       // Generate spot white layer for UV
  sublimationHeatCompensation?: boolean;  // Pre-compensate for heat darkening
  registrationMarks?: boolean;            // 4 optical registration marks for cutters
  includeBleedSlugText?: boolean;         // Tiny order id printed in bleed
  includeDieLineOverlay?: boolean;        // Whether to draw cut die-line directly on production PDF
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerCity?: string;
  customerNotes?: string;
  modelId: string;
  modelName: string;
  brandName: string;
  previewUrl: string;             // Low-res mockup preview
  printPdfUrl?: string;           // Production PDF (Clean or with die-line according to options)
  proofPdfUrl?: string;           // Inspection PDF with die-line overlay & safe guides
  printPngUrl?: string;           // High-res 300 DPI PNG
  cutSvgUrl?: string;             // Vector die-line cut path
  whiteUnderbasePngUrl?: string;  // Spot white mask for UV printers
  technology?: PrintTechnology;
  caseType?: CaseType;
  designData: DesignData;
  preflightReport: PreflightReport;
  status: 'pending' | 'processing' | 'printed' | 'shipped' | 'cancelled';
  createdAt: string;
}

export interface GangSheetItem {
  orderId: string;
  modelName: string;
  pngBuffer: Buffer | string;     // file path or buffer
  widthMm: number;
  heightMm: number;
  label: string;
}
