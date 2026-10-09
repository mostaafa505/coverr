'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Upload,
  Type,
  Shapes,
  Layers,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Sliders,
  Trash2,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Printer,
  Download,
  Info,
  Camera,
  Search,
  Ruler,
  Maximize2,
  RotateCw,
  AlignCenter,
  Sparkles,
  ArrowUp,
  ArrowDown,
  X,
  FileCode,
  FileText,
  Smartphone,
  Eye,
  EyeOff,
  Filter,
  Check,
  Copy,
  Sun,
  Contrast,
  Palette,
  Minus,
  Plus,
  Wand2,
  Box,
  Share2,
  FileSpreadsheet,
  LayoutGrid,
} from 'lucide-react';
import {
  DeviceModel,
  CanvasElement,
  ImageElement,
  TextElement,
  ShapeElement,
  DesignData,
  PreflightReport,
  Brand,
} from '@/types';
import { runPreflightCheck } from '@/lib/preflight';

interface PrintStudioProps {
  initialModelId?: string;
}

export default function PrintStudio({ initialModelId }: PrintStudioProps) {
  // Device & Catalog State (397 models across 26 brands)
  const [allModels, setAllModels] = useState<DeviceModel[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [selectedModel, setSelectedModel] = useState<DeviceModel | null>(null);
  const [loadingModels, setLoadingModels] = useState<boolean>(true);

  // Device Switcher Drawer State
  const [deviceSearchOpen, setDeviceSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  // Canvas Measurements & Scale (pixels per mm)
  const [scalePxPerMm, setScalePxPerMm] = useState<number>(4.2);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Template Calibrator Modal
  const [calibratorOpen, setCalibratorOpen] = useState<boolean>(false);
  const [tempWidthMm, setTempWidthMm] = useState<number>(75);
  const [tempHeightMm, setTempHeightMm] = useState<number>(160);
  const [tempRadiusMm, setTempRadiusMm] = useState<number>(6);
  const [tempBleedMm, setTempBleedMm] = useState<number>(3);

  // Studio Elements State
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');
  const [renderTick, setRenderTick] = useState<number>(0);

  // Drag & drop highlight state
  const [isDragOverCanvas, setIsDragOverCanvas] = useState<boolean>(false);

  // History for Undo / Redo
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Active Tool Panel
  const [activeTool, setActiveTool] = useState<'upload' | 'text' | 'shapes' | 'adjust' | 'layers' | 'collage'>('upload');
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [showRulers, setShowRulers] = useState<boolean>(true);

  // Text Tool Inputs
  const [newText, setNewText] = useState<string>('طباعة كفر برنت');
  const [fontFamily, setFontFamily] = useState<string>('IBM Plex Sans Arabic');
  const [textColor, setTextColor] = useState<string>('#141413');
  const [fontSize, setFontSize] = useState<number>(26);
  const [textCurve, setTextCurve] = useState<number>(0);

  // Workshop Production & Material Profiles
  const [printTechnology, setPrintTechnology] = useState<'sublimation' | 'uv' | 'dtf'>('sublimation');
  const [caseType, setCaseType] = useState<'2d_flat' | '3d_wrap' | 'tpu_clear' | 'hard_pc'>('2d_flat');
  const [isMirroredPreview, setIsMirroredPreview] = useState<boolean>(false);
  const [heatCompensation, setHeatCompensation] = useState<boolean>(true);
  const [registrationMarks, setRegistrationMarks] = useState<boolean>(true);
  const [includeBleedSlug, setIncludeBleedSlug] = useState<boolean>(true);
  const [includeDieLineOnPrint, setIncludeDieLineOnPrint] = useState<boolean>(false);

  // Visitor Mobile Detection
  const [detectedPhoneName, setDetectedPhoneName] = useState<string | null>(null);
  const [detectedModelId, setDetectedModelId] = useState<string | null>(null);

  // Workshop Production Modals (3D, Proof, Gang Sheet)
  const [is3dMockupOpen, setIs3dMockupOpen] = useState<boolean>(false);
  const [proofModalOpen, setProofModalOpen] = useState<boolean>(false);
  const [proofDataUrl, setProofDataUrl] = useState<string | null>(null);
  const [gangSheetModalOpen, setGangSheetModalOpen] = useState<boolean>(false);
  const [gangSheetResult, setGangSheetResult] = useState<any | null>(null);
  const [isGeneratingGangSheet, setIsGeneratingGangSheet] = useState<boolean>(false);
  const [gangSheetSize, setGangSheetSize] = useState<'A3' | 'A4'>('A3');

  // Cutout Collision Warning
  const [cutoutCollisionWarning, setCutoutCollisionWarning] = useState<string | null>(null);

  // Export & Download State
  const [exportModalOpen, setExportModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportResult, setExportResult] = useState<any | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [forceOverride, setForceOverride] = useState<boolean>(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef<{
    mode: 'none' | 'move' | 'resize-se' | 'resize-sw' | 'resize-ne' | 'resize-nw' | 'rotate';
    startX: number;
    startY: number;
    elementStart: {
      x: number;
      y: number;
      scaleX: number;
      scaleY: number;
      rotation: number;
      w: number;
      h: number;
      originalWidth: number;
      originalHeight: number;
    };
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    elementStart: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, w: 100, h: 100, originalWidth: 100, originalHeight: 100 },
  });
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const elementStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 1. Fetch all models & brands on mount
  useEffect(() => {
    async function loadData() {
      setLoadingModels(true);
      try {
        const [modelsRes, brandsRes] = await Promise.all([
          fetch('/api/models'),
          fetch('/api/brands'),
        ]);
        const [modelsData, brandsData] = await Promise.all([
          modelsRes.json(),
          brandsRes.json(),
        ]);

        if (modelsData.success) {
          setAllModels(modelsData.models);
          let target = modelsData.models.find((m: DeviceModel) => m.id === initialModelId);
          if (!target) {
            target =
              modelsData.models.find((m: DeviceModel) => m.id === 'xiaomi-redmi-note-13-4g') ||
              modelsData.models.find((m: DeviceModel) => m.id === 'apple-iphone-15-pro-max') ||
              modelsData.models.find((m: DeviceModel) => m.id === 'samsung-galaxy-s24-ultra') ||
              modelsData.models[0];
          }
          if (target) {
            setSelectedModel(target);
            initCalibrator(target);
          }
        }
        if (brandsData.success) {
          setAllBrands(brandsData.brands);
        }
      } catch (err) {
        console.error('Failed to load models data:', err);
      } finally {
        setLoadingModels(false);
      }
    }
    loadData();
  }, [initialModelId]);

  const initCalibrator = (m: DeviceModel) => {
    if (m.template) {
      setTempWidthMm(m.template.widthMm);
      setTempHeightMm(m.template.heightMm);
      setTempRadiusMm(m.template.cornerRadiusMm || 6);
      setTempBleedMm(m.template.bleedMm || 3);
    }
  };

  // Switch to another model
  const handleSelectModel = (model: DeviceModel) => {
    setSelectedModel(model);
    initCalibrator(model);
    setDeviceSearchOpen(false);
  };

  // Physical Millimeters for current model
  const template = selectedModel?.template || {
    widthMm: 75,
    heightMm: 160,
    cornerRadiusMm: 6,
    bleedMm: 3,
    safeMarginMm: 3,
    cutouts: [],
  };

  // Dynamic bleed: 3D wrap-around requires 12mm bleed for vacuum heat press around edges
  const bleedMm = caseType === '3d_wrap' ? 12.0 : (template.bleedMm || 3.0);
  const safeMarginMm = template.safeMarginMm || 3.0;
  const trimWidthMm = template.widthMm;
  const trimHeightMm = template.heightMm;
  const totalWidthMm = trimWidthMm + bleedMm * 2;
  const totalHeightMm = trimHeightMm + bleedMm * 2;

  const canvasWidthPx = Math.round(totalWidthMm * scalePxPerMm);
  const canvasHeightPx = Math.round(totalHeightMm * scalePxPerMm);

  // Undo / Redo helpers
  const pushHistory = (newElems: CanvasElement[]) => {
    const updated = history.slice(0, historyIndex + 1);
    updated.push(JSON.parse(JSON.stringify(newElems)));
    setHistory(updated);
    setHistoryIndex(updated.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setElements(JSON.parse(JSON.stringify(prev)));
      setHistoryIndex(historyIndex - 1);
      setRenderTick((t) => t + 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setElements(JSON.parse(JSON.stringify(next)));
      setHistoryIndex(historyIndex + 1);
      setRenderTick((t) => t + 1);
    }
  };

  // Calculate live DPI for an image element
  const calculateDpi = (el: ImageElement): number => {
    const renderedWidthMm = (el.originalWidth * el.scaleX) / scalePxPerMm;
    if (renderedWidthMm <= 0) return 300;
    return Math.round(el.originalWidth / (renderedWidthMm / 25.4));
  };

  // BULLETPROOF: Client-side file loader with instant Data URL & zero server wait
  const processImageFile = (file: File) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const img = new Image();
      img.onload = () => {
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;

        // Cache image immediately
        loadedImagesRef.current.set(dataUrl, img);

        // Fit nicely inside canvas (cover ~90% of width)
        const targetWidthPx = canvasWidthPx * 0.95;
        const scale = Math.min(1.0, targetWidthPx / naturalWidth);

        const newEl: ImageElement = {
          id: `img-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'image',
          src: dataUrl,
          originalWidth: naturalWidth,
          originalHeight: naturalHeight,
          x: Math.round((canvasWidthPx - naturalWidth * scale) / 2),
          y: Math.round((canvasHeightPx - naturalHeight * scale) / 2),
          scaleX: scale,
          scaleY: scale,
          rotation: 0,
          opacity: 1,
          zIndex: elements.length + 1,
          currentDpi: Math.round(naturalWidth / (((naturalWidth * scale) / scalePxPerMm) / 25.4)),
          filters: {},
        };

        const updated = [...elements, newEl];
        setElements(updated);
        setSelectedId(newEl.id);
        pushHistory(updated);
        setRenderTick((t) => t + 1);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
      e.target.value = ''; // Reset input
    }
  };

  // Drag and Drop handlers for Canvas
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCanvas(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCanvas(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverCanvas(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
  };

  // Add Text
  const handleAddText = () => {
    if (!newText.trim()) return;

    const newEl: TextElement = {
      id: `text-${Date.now()}`,
      type: 'text',
      text: newText,
      fontFamily: fontFamily,
      fontSize: fontSize,
      fill: textColor,
      align: 'center',
      x: Math.round(canvasWidthPx / 2 - 60),
      y: Math.round(canvasHeightPx / 2 - 20),
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      zIndex: elements.length + 1,
    };

    const updated = [...elements, newEl];
    setElements(updated);
    setSelectedId(newEl.id);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Add Shape
  const handleAddShape = (shapeType: 'rect' | 'circle' | 'heart') => {
    const newEl: ShapeElement = {
      id: `shape-${Date.now()}`,
      type: 'shape',
      shapeType,
      width: 80,
      height: 80,
      fill: '#C22915',
      x: Math.round(canvasWidthPx / 2 - 40),
      y: Math.round(canvasHeightPx / 2 - 40),
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
      opacity: 1,
      zIndex: elements.length + 1,
    };

    const updated = [...elements, newEl];
    setElements(updated);
    setSelectedId(newEl.id);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Fit Image to Bleed (Covers entire case including 3mm bleed)
  const fitImageToBleed = () => {
    if (!selectedId) return;
    const target = elements.find((e) => e.id === selectedId);
    if (!target || target.type !== 'image') return;

    const imgEl = target as ImageElement;
    // Calculate scale to cover canvasWidthPx and canvasHeightPx
    const scaleX = canvasWidthPx / imgEl.originalWidth;
    const scaleY = canvasHeightPx / imgEl.originalHeight;
    const maxScale = Math.max(scaleX, scaleY);

    const newW = imgEl.originalWidth * maxScale;
    const newH = imgEl.originalHeight * maxScale;

    const updated = elements.map((el) => {
      if (el.id === selectedId) {
        return {
          ...el,
          scaleX: maxScale,
          scaleY: maxScale,
          x: Math.round((canvasWidthPx - newW) / 2),
          y: Math.round((canvasHeightPx - newH) / 2),
        };
      }
      return el;
    });

    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Center Image
  const centerSelected = () => {
    if (!selectedId) return;
    const target = elements.find((e) => e.id === selectedId);
    if (!target) return;

    let elW = 100;
    let elH = 100;
    if (target.type === 'image') {
      elW = (target as ImageElement).originalWidth * target.scaleX;
      elH = (target as ImageElement).originalHeight * target.scaleY;
    } else if (target.type === 'shape') {
      elW = (target as ShapeElement).width * target.scaleX;
      elH = (target as ShapeElement).height * target.scaleY;
    }

    const updated = elements.map((el) => {
      if (el.id === selectedId) {
        return {
          ...el,
          x: Math.round((canvasWidthPx - elW) / 2),
          y: Math.round((canvasHeightPx - elH) / 2),
        };
      }
      return el;
    });

    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Rotate 90
  const rotateSelected90 = () => {
    if (!selectedId) return;
    const updated = elements.map((el) => {
      if (el.id === selectedId) {
        return {
          ...el,
          rotation: (el.rotation + 90) % 360,
        };
      }
      return el;
    });
    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Rotate -90
  const rotateSelectedMinus90 = () => {
    if (!selectedId) return;
    const updated = elements.map((el) => {
      if (el.id === selectedId) {
        return {
          ...el,
          rotation: (el.rotation - 90 + 360) % 360,
        };
      }
      return el;
    });
    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Fit Image to Trim (Fully visible inside phone body)
  const fitImageToTrim = () => {
    if (!selectedId) return;
    const target = elements.find((e) => e.id === selectedId);
    if (!target || target.type !== 'image') return;
    const imgEl = target as ImageElement;

    const trimWPx = trimWidthMm * scalePxPerMm;
    const trimHPx = trimHeightMm * scalePxPerMm;
    const scale = Math.min(trimWPx / imgEl.originalWidth, trimHPx / imgEl.originalHeight);
    const newW = imgEl.originalWidth * scale;
    const newH = imgEl.originalHeight * scale;

    const updated = elements.map((el) => {
      if (el.id === selectedId) {
        return {
          ...el,
          scaleX: Number(scale.toFixed(3)),
          scaleY: Number(scale.toFixed(3)),
          x: Math.round((canvasWidthPx - newW) / 2),
          y: Math.round((canvasHeightPx - newH) / 2),
        };
      }
      return el;
    });
    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Scale Step (+/- delta)
  const adjustScaleStep = (delta: number) => {
    if (!selectedId) return;
    const updated = elements.map((el) => {
      if (el.id === selectedId) {
        const newScale = Math.max(0.05, Math.min(4.0, Number((el.scaleX + delta).toFixed(3))));
        return {
          ...el,
          scaleX: newScale,
          scaleY: newScale,
          ...(el.type === 'image'
            ? { currentDpi: Math.round((el as ImageElement).originalWidth / ((( (el as ImageElement).originalWidth * newScale) / scalePxPerMm) / 25.4)) }
            : {}),
        };
      }
      return el;
    });
    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Duplicate Selected
  const duplicateSelected = () => {
    if (!selectedId) return;
    const item = elements.find((e) => e.id === selectedId);
    if (!item) return;
    const cloned = {
      ...JSON.parse(JSON.stringify(item)),
      id: `${item.type}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      x: item.x + 18,
      y: item.y + 18,
      zIndex: elements.length + 1,
    };
    const updated = [...elements, cloned];
    setElements(updated);
    setSelectedId(cloned.id);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Send to Back (Background layer)
  const sendSelectedToBack = () => {
    if (!selectedId) return;
    const minZ = Math.min(...elements.map((e) => e.zIndex), 0);
    const updated = elements.map((e) =>
      e.id === selectedId ? { ...e, zIndex: minZ - 1 } : e
    );
    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Bring to Front
  const bringSelectedToFront = () => {
    if (!selectedId) return;
    const maxZ = Math.max(...elements.map((e) => e.zIndex), 0);
    const updated = elements.map((e) =>
      e.id === selectedId ? { ...e, zIndex: maxZ + 1 } : e
    );
    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Flip Horizontal
  const toggleFlipX = () => {
    if (!selectedId) return;
    const target = elements.find((e) => e.id === selectedId);
    if (!target || target.type !== 'image') return;
    const updated = elements.map((el) => {
      if (el.id === selectedId) {
        const imgEl = el as ImageElement;
        return {
          ...imgEl,
          filters: {
            ...(imgEl.filters || {}),
            flipX: !imgEl.filters?.flipX,
          },
        };
      }
      return el;
    });
    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Flip Vertical
  const toggleFlipY = () => {
    if (!selectedId) return;
    const target = elements.find((e) => e.id === selectedId);
    if (!target || target.type !== 'image') return;
    const updated = elements.map((el) => {
      if (el.id === selectedId) {
        const imgEl = el as ImageElement;
        return {
          ...imgEl,
          filters: {
            ...(imgEl.filters || {}),
            flipY: !imgEl.filters?.flipY,
          },
        };
      }
      return el;
    });
    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Quick Action: Apply Filter Preset
  const applyFilterPreset = (preset: 'normal' | 'bw' | 'warm' | 'vibrant' | 'dramatic') => {
    if (!selectedId) return;
    const updated = elements.map((el) => {
      if (el.id === selectedId && el.type === 'image') {
        const imgEl = el as ImageElement;
        let newFilters = { ...(imgEl.filters || {}) };
        if (preset === 'normal') {
          newFilters = { flipX: imgEl.filters?.flipX, flipY: imgEl.filters?.flipY, brightness: 100, contrast: 100, saturation: 100, grayscale: false, sepia: false };
        } else if (preset === 'bw') {
          newFilters.grayscale = true;
          newFilters.sepia = false;
          newFilters.contrast = 125;
        } else if (preset === 'warm') {
          newFilters.grayscale = false;
          newFilters.sepia = true;
          newFilters.brightness = 105;
        } else if (preset === 'vibrant') {
          newFilters.grayscale = false;
          newFilters.sepia = false;
          newFilters.saturation = 145;
          newFilters.contrast = 115;
        } else if (preset === 'dramatic') {
          newFilters.grayscale = false;
          newFilters.sepia = false;
          newFilters.contrast = 140;
          newFilters.brightness = 95;
        }
        return { ...imgEl, filters: newFilters };
      }
      return el;
    });
    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // 1-Click Smart Background Remover (Client-Side Canvas Processing)
  const removeImageBackground = () => {
    if (!selectedElement || selectedElement.type !== 'image') return;
    const imgEl = selectedElement as ImageElement;
    const img = loadedImagesRef.current.get(imgEl.src);
    if (!img) return;

    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = img.naturalWidth;
      offscreen.height = img.naturalHeight;
      const ctx = offscreen.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
      const data = imgData.data;

      // Sample 4 corners to detect background color
      const w = offscreen.width;
      const h = offscreen.height;
      const sampleIndices = [
        0,                                   // Top-Left
        (w - 1) * 4,                         // Top-Right
        ((h - 1) * w) * 4,                   // Bottom-Left
        ((h - 1) * w + (w - 1)) * 4,         // Bottom-Right
      ];

      let bgR = 0, bgG = 0, bgB = 0;
      for (const idx of sampleIndices) {
        bgR += data[idx];
        bgG += data[idx + 1];
        bgB += data[idx + 2];
      }
      bgR /= sampleIndices.length;
      bgG /= sampleIndices.length;
      bgB /= sampleIndices.length;

      const tolerance = 48; // Color distance threshold

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const dist = Math.sqrt(
          (r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2
        );

        if (dist < tolerance) {
          // Feather alpha edge
          data[i + 3] = Math.max(0, Math.round(((dist / tolerance) ** 1.5) * 255));
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const transparentDataUrl = offscreen.toDataURL('image/png');
      const newImg = new Image();
      newImg.onload = () => {
        loadedImagesRef.current.set(transparentDataUrl, newImg);
        const updated = elements.map((el) =>
          el.id === imgEl.id ? ({ ...el, src: transparentDataUrl } as CanvasElement) : el
        );
        setElements(updated);
        pushHistory(updated);
        setRenderTick((t) => t + 1);
      };
      newImg.src = transparentDataUrl;
    } catch (err) {
      console.warn('Background removal error:', err);
    }
  };

  // Check face / subject collision with camera cutout
  const checkCutoutCollision = useCallback(() => {
    if (!selectedModel?.template?.cutouts?.length) {
      setCutoutCollisionWarning(null);
      return;
    }

    const imgElements = elements.filter((el) => el.type === 'image') as ImageElement[];
    if (!imgElements.length) {
      setCutoutCollisionWarning(null);
      return;
    }

    for (const imgEl of imgElements) {
      const elW = imgEl.originalWidth * imgEl.scaleX;
      const elH = imgEl.originalHeight * imgEl.scaleY;
      const elX1 = imgEl.x;
      const elY1 = imgEl.y;
      const elX2 = elX1 + elW;
      const elY2 = elY1 + elH;

      for (const cutout of selectedModel.template.cutouts) {
        const cX1 = (bleedMm + cutout.xMm) * scalePxPerMm;
        const cY1 = (bleedMm + cutout.yMm) * scalePxPerMm;
        const cX2 = cX1 + cutout.widthMm * scalePxPerMm;
        const cY2 = cY1 + cutout.heightMm * scalePxPerMm;

        // Check intersection with upper 45% of image (head/portrait zone)
        const headY2 = elY1 + elH * 0.45;
        const overlaps = !(elX2 < cX1 || elX1 > cX2 || headY2 < cY1 || elY1 > cY2);

        if (overlaps) {
          setCutoutCollisionWarning(`⚠️ تنبيه الورشة: جزء رئيسي من الصورة (منطقة الوجه) واقع تحت ${cutout.nameAr || 'فتحة الكاميرا'}! يرجى تحريك الصورة لأسفل.`);
          return;
        }
      }
    }
    setCutoutCollisionWarning(null);
  }, [elements, selectedModel, bleedMm, scalePxPerMm]);

  useEffect(() => {
    checkCutoutCollision();
  }, [elements, checkCutoutCollision]);

  // Apply Collage Preset Layout
  const applyCollageLayout = (layout: 'split-v' | 'split-h' | 'grid-3' | 'grid-4' | 'grad-frame') => {
    const margin = bleedMm * scalePxPerMm;
    const w = trimWidthMm * scalePxPerMm;
    const h = trimHeightMm * scalePxPerMm;
    const gap = 3 * scalePxPerMm;

    let newShapes: ShapeElement[] = [];

    if (layout === 'split-v') {
      const colW = (w - gap) / 2;
      newShapes = [
        {
          id: `shape-${Date.now()}-1`,
          type: 'shape',
          shapeType: 'rect',
          x: margin,
          y: margin,
          width: colW,
          height: h,
          fill: '#E2E8F0',
          stroke: '#94A3B8',
          strokeWidth: 2,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 0.85,
          zIndex: 1,
        },
        {
          id: `shape-${Date.now()}-2`,
          type: 'shape',
          shapeType: 'rect',
          x: margin + colW + gap,
          y: margin,
          width: colW,
          height: h,
          fill: '#CBD5E1',
          stroke: '#94A3B8',
          strokeWidth: 2,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 0.85,
          zIndex: 2,
        },
      ];
    } else if (layout === 'split-h') {
      const rowH = (h - gap) / 2;
      newShapes = [
        {
          id: `shape-${Date.now()}-1`,
          type: 'shape',
          shapeType: 'rect',
          x: margin,
          y: margin,
          width: w,
          height: rowH,
          fill: '#E2E8F0',
          stroke: '#94A3B8',
          strokeWidth: 2,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 0.85,
          zIndex: 1,
        },
        {
          id: `shape-${Date.now()}-2`,
          type: 'shape',
          shapeType: 'rect',
          x: margin,
          y: margin + rowH + gap,
          width: w,
          height: rowH,
          fill: '#CBD5E1',
          stroke: '#94A3B8',
          strokeWidth: 2,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
          opacity: 0.85,
          zIndex: 2,
        },
      ];
    } else if (layout === 'grid-4') {
      const colW = (w - gap) / 2;
      const rowH = (h - gap) / 2;
      newShapes = [
        { id: `s-1`, type: 'shape', shapeType: 'rect', x: margin, y: margin, width: colW, height: rowH, fill: '#F1F5F9', stroke: '#CBD5E1', strokeWidth: 1.5, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.9, zIndex: 1 },
        { id: `s-2`, type: 'shape', shapeType: 'rect', x: margin + colW + gap, y: margin, width: colW, height: rowH, fill: '#E2E8F0', stroke: '#CBD5E1', strokeWidth: 1.5, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.9, zIndex: 2 },
        { id: `s-3`, type: 'shape', shapeType: 'rect', x: margin, y: margin + rowH + gap, width: colW, height: rowH, fill: '#E2E8F0', stroke: '#CBD5E1', strokeWidth: 1.5, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.9, zIndex: 3 },
        { id: `s-4`, type: 'shape', shapeType: 'rect', x: margin + colW + gap, y: margin + rowH + gap, width: colW, height: rowH, fill: '#F1F5F9', stroke: '#CBD5E1', strokeWidth: 1.5, rotation: 0, scaleX: 1, scaleY: 1, opacity: 0.9, zIndex: 4 },
      ];
    }

    const updated = [...elements, ...newShapes];
    setElements(updated);
    pushHistory(updated);
    setRenderTick((t) => t + 1);
  };

  // Generate Customer Proof Sheet (With Watermark for Client Approval on WhatsApp)
  const generateCustomerProof = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const proofCanvas = document.createElement('canvas');
    proofCanvas.width = 1200;
    proofCanvas.height = 1600;
    const pctx = proofCanvas.getContext('2d');
    if (!pctx) return;

    // Workshop clean background
    pctx.fillStyle = '#F4F2ED';
    pctx.fillRect(0, 0, 1200, 1600);

    // Workshop Header
    pctx.fillStyle = '#141413';
    pctx.font = 'bold 36px "IBM Plex Sans Arabic", sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText('بروفة اعتماد الطباعة النهائية • ورشة الإنتاج', 600, 70);

    pctx.font = '22px "IBM Plex Sans Arabic", sans-serif';
    pctx.fillStyle = '#5A5850';
    pctx.fillText(`موديل الهاتف: ${selectedModel?.name} | التاريخ: ${new Date().toLocaleDateString('ar-EG')}`, 600, 115);

    // Draw case artwork centered
    const caseAspect = canvas.width / canvas.height;
    const targetH = 1100;
    const targetW = targetH * caseAspect;
    const caseX = (1200 - targetW) / 2;
    const caseY = 170;

    // Drop Shadow
    pctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    pctx.shadowBlur = 30;
    pctx.shadowOffsetY = 15;
    pctx.drawImage(canvas, caseX, caseY, targetW, targetH);
    pctx.shadowColor = 'transparent';

    // Semi-Transparent Diagonal Watermarks
    pctx.save();
    pctx.translate(600, 800);
    pctx.rotate(-Math.PI / 4);
    pctx.fillStyle = 'rgba(194, 41, 21, 0.16)';
    pctx.font = 'bold 58px "IBM Plex Sans Arabic", sans-serif';
    pctx.textAlign = 'center';
    pctx.fillText('بروفة اعتماد للعميل • PROOF ONLY', 0, -80);
    pctx.fillText('غير مصرح بالطباعة قبل الموافقة', 0, 80);
    pctx.restore();

    // Footer approval box
    pctx.fillStyle = '#FFFFFF';
    pctx.fillRect(80, 1340, 1040, 190);
    pctx.strokeStyle = '#D4D1C7';
    pctx.lineWidth = 2;
    pctx.strokeRect(80, 1340, 1040, 190);

    pctx.fillStyle = '#141413';
    pctx.font = 'bold 24px "IBM Plex Sans Arabic", sans-serif';
    pctx.textAlign = 'right';
    pctx.fillText('شروط اعتماد البروفة:', 1080, 1385);

    pctx.font = '20px "IBM Plex Sans Arabic", sans-serif';
    pctx.fillStyle = '#4F4D46';
    pctx.fillText('1. يرجى التأكد من صحة الحروف والأسماء والأرقام وموضع فتحة الكاميرا.', 1080, 1425);
    pctx.fillText('2. قد يختلف تدرج الألوان المطبوعة بنسبة طفيفة (5-10%) طبقاً لطبيعة الخامة والحرارة.', 1080, 1465);
    pctx.fillText('3. بمجرد اعتماد هذه البروفة، يتم إرسال أمر التشغيل للماكينات مباشرة.', 1080, 1505);

    const dataUrl = proofCanvas.toDataURL('image/jpeg', 0.92);
    setProofDataUrl(dataUrl);
    setProofModalOpen(true);
  };

  // Gang Sheet Generator Action
  const handleGenerateGangSheet = async (size: 'A3' | 'A4') => {
    setIsGeneratingGangSheet(true);
    setGangSheetResult(null);
    try {
      const res = await fetch('/api/orders/gang-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetSize: size }),
      });
      const data = await res.json();
      if (data.success) {
        setGangSheetResult(data);
      } else {
        alert(data.error || 'حدث خطأ أثناء تجميع الفرخ');
      }
    } catch (e: any) {
      alert('خطأ في الاتصال بالخادم: ' + e.message);
    } finally {
      setIsGeneratingGangSheet(false);
    }
  };

  const downloadCanvasAsPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${selectedModel?.name?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'case_print'}_300DPI_PRINT.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Render HTML5 Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasWidthPx, canvasHeightPx);

    // Case background color
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);

    // Live Sublimation Horizontal Mirroring Transform
    if (isMirroredPreview) {
      ctx.save();
      ctx.translate(canvasWidthPx, 0);
      ctx.scale(-1, 1);
    }

    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);

    for (const el of sorted) {
      if (el.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = el.opacity;
      ctx.translate(el.x, el.y);
      if (el.rotation) {
        ctx.rotate((el.rotation * Math.PI) / 180);
      }
      ctx.scale(el.scaleX, el.scaleY);

      if (el.type === 'image') {
        let img = loadedImagesRef.current.get(el.src);
        if (!img) {
          // If not in cache yet, load asynchronously and force redraw
          img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            loadedImagesRef.current.set(el.src, img!);
            setRenderTick((t) => t + 1);
          };
          img.src = el.src;
        } else if (img.complete && img.naturalWidth > 0) {
          const f = el.filters || {};
          const filterParts: string[] = [];
          if (f.brightness !== undefined && f.brightness !== 100) filterParts.push(`brightness(${f.brightness}%)`);
          if (f.contrast !== undefined && f.contrast !== 100) filterParts.push(`contrast(${f.contrast}%)`);
          if (f.saturation !== undefined && f.saturation !== 100) filterParts.push(`saturate(${f.saturation}%)`);
          if (f.grayscale) filterParts.push('grayscale(100%)');
          if (f.sepia) filterParts.push('sepia(100%)');
          if (f.blur) filterParts.push(`blur(${f.blur}px)`);
          ctx.filter = filterParts.length > 0 ? filterParts.join(' ') : 'none';

          ctx.save();
          if (f.flipX || f.flipY) {
            ctx.translate(f.flipX ? el.originalWidth : 0, f.flipY ? el.originalHeight : 0);
            ctx.scale(f.flipX ? -1 : 1, f.flipY ? -1 : 1);
          }
          ctx.drawImage(img, 0, 0, el.originalWidth, el.originalHeight);
          ctx.restore();
          ctx.filter = 'none';
        }
      } else if (el.type === 'text') {
        ctx.font = `${el.bold ? 'bold ' : ''}${el.fontSize}px '${el.fontFamily}', sans-serif`;
        ctx.fillStyle = el.fill;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        if (el.stroke && el.strokeWidth) {
          ctx.strokeStyle = el.stroke;
          ctx.lineWidth = el.strokeWidth;
          ctx.strokeText(el.text, 0, 0);
        }
        ctx.fillText(el.text, 0, 0);
      } else if (el.type === 'shape') {
        ctx.fillStyle = el.fill;
        if (el.shapeType === 'circle') {
          ctx.beginPath();
          ctx.arc(el.width / 2, el.height / 2, el.width / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (el.shapeType === 'rect') {
          ctx.fillRect(0, 0, el.width, el.height);
        } else if (el.shapeType === 'heart') {
          const w = el.width;
          const h = el.height;
          ctx.beginPath();
          ctx.moveTo(w / 2, h / 4);
          ctx.bezierCurveTo(w / 2, 0, 0, 0, 0, h / 3);
          ctx.bezierCurveTo(0, (2 * h) / 3, w / 2, (7 * h) / 8, w / 2, h);
          ctx.bezierCurveTo(w / 2, (7 * h) / 8, w, (2 * h) / 3, w, h / 3);
          ctx.bezierCurveTo(w, 0, w / 2, 0, w / 2, h / 4);
          ctx.fill();
        }
      }

      // Premium Selection Bounding Box & Corner Resize Handles
      if (el.id === selectedId) {
        let boundW = 100;
        let boundH = 100;
        if (el.type === 'image') {
          boundW = el.originalWidth;
          boundH = el.originalHeight;
        } else if (el.type === 'text') {
          boundW = el.text.length * (el.fontSize * 0.6);
          boundH = el.fontSize * 1.2;
        } else if (el.type === 'shape') {
          boundW = el.width;
          boundH = el.height;
        }

        // Bounding outline
        ctx.lineWidth = 1.5 / el.scaleX;
        ctx.strokeStyle = '#1D4ED8';
        ctx.setLineDash([4 / el.scaleX, 4 / el.scaleX]);
        ctx.strokeRect(0, 0, boundW, boundH);
        ctx.setLineDash([]);

        // Rotation stem & knob
        ctx.strokeStyle = '#1D4ED8';
        ctx.beginPath();
        ctx.moveTo(boundW / 2, 0);
        ctx.lineTo(boundW / 2, -22 / el.scaleY);
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(boundW / 2, -22 / el.scaleY, 4.5 / el.scaleX, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 4 Corner resize handles
        const hs = 8 / el.scaleX;
        const drawHandle = (hx: number, hy: number) => {
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = '#1D4ED8';
          ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
          ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
        };

        drawHandle(0, 0);
        drawHandle(boundW, 0);
        drawHandle(boundW, boundH);
        drawHandle(0, boundH);
      }

      ctx.restore();
    }

    if (isMirroredPreview) {
      ctx.restore();
    }
  }, [elements, selectedId, backgroundColor, canvasWidthPx, canvasHeightPx, isMirroredPreview]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas, renderTick]);

  const selectedElement = elements.find((e) => e.id === selectedId);

  const updateSelected = (updater: (prev: CanvasElement) => CanvasElement) => {
    if (!selectedId) return;
    const updated = elements.map((el) => (el.id === selectedId ? updater(el) : el));
    setElements(updated);
    setRenderTick((t) => t + 1);
  };

  // Canvas Mouse Dragging & Interactive Corner Transform Handles
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoomLevel;
    const clickY = (e.clientY - rect.top) / zoomLevel;

    // 1. Check if clicking on handles of CURRENTLY selected element
    if (selectedId) {
      const selected = elements.find((el) => el.id === selectedId);
      if (selected && !selected.locked) {
        let origW = 100;
        let origH = 100;
        if (selected.type === 'image') {
          origW = (selected as ImageElement).originalWidth;
          origH = (selected as ImageElement).originalHeight;
        } else if (selected.type === 'text') {
          origW = (selected as TextElement).text.length * ((selected as TextElement).fontSize * 0.6);
          origH = (selected as TextElement).fontSize * 1.2;
        } else if (selected.type === 'shape') {
          origW = (selected as ShapeElement).width;
          origH = (selected as ShapeElement).height;
        }

        const w = origW * selected.scaleX;
        const h = origH * selected.scaleY;
        const sx = selected.x;
        const sy = selected.y;
        const hr = 12; // tolerance

        // SE handle (bottom-right)
        if (Math.abs(clickX - (sx + w)) <= hr && Math.abs(clickY - (sy + h)) <= hr) {
          transformRef.current = {
            mode: 'resize-se',
            startX: clickX,
            startY: clickY,
            elementStart: { x: sx, y: sy, scaleX: selected.scaleX, scaleY: selected.scaleY, rotation: selected.rotation, w, h, originalWidth: origW, originalHeight: origH },
          };
          return;
        }
        // SW handle (bottom-left)
        if (Math.abs(clickX - sx) <= hr && Math.abs(clickY - (sy + h)) <= hr) {
          transformRef.current = {
            mode: 'resize-sw',
            startX: clickX,
            startY: clickY,
            elementStart: { x: sx, y: sy, scaleX: selected.scaleX, scaleY: selected.scaleY, rotation: selected.rotation, w, h, originalWidth: origW, originalHeight: origH },
          };
          return;
        }
        // NE handle (top-right)
        if (Math.abs(clickX - (sx + w)) <= hr && Math.abs(clickY - sy) <= hr) {
          transformRef.current = {
            mode: 'resize-ne',
            startX: clickX,
            startY: clickY,
            elementStart: { x: sx, y: sy, scaleX: selected.scaleX, scaleY: selected.scaleY, rotation: selected.rotation, w, h, originalWidth: origW, originalHeight: origH },
          };
          return;
        }
        // NW handle (top-left)
        if (Math.abs(clickX - sx) <= hr && Math.abs(clickY - sy) <= hr) {
          transformRef.current = {
            mode: 'resize-nw',
            startX: clickX,
            startY: clickY,
            elementStart: { x: sx, y: sy, scaleX: selected.scaleX, scaleY: selected.scaleY, rotation: selected.rotation, w, h, originalWidth: origW, originalHeight: origH },
          };
          return;
        }
        // Rotate handle (top center - 22px)
        if (Math.abs(clickX - (sx + w / 2)) <= hr && Math.abs(clickY - (sy - 22)) <= hr) {
          transformRef.current = {
            mode: 'rotate',
            startX: clickX,
            startY: clickY,
            elementStart: { x: sx, y: sy, scaleX: selected.scaleX, scaleY: selected.scaleY, rotation: selected.rotation, w, h, originalWidth: origW, originalHeight: origH },
          };
          return;
        }
      }
    }

    // 2. Element hit test
    const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);
    let hit: CanvasElement | null = null;

    for (const el of sorted) {
      if (el.locked) continue;
      let origW = 100;
      let origH = 100;
      if (el.type === 'image') {
        origW = (el as ImageElement).originalWidth;
        origH = (el as ImageElement).originalHeight;
      } else if (el.type === 'text') {
        origW = (el as TextElement).text.length * ((el as TextElement).fontSize * 0.6);
        origH = (el as TextElement).fontSize * 1.2;
      } else if (el.type === 'shape') {
        origW = (el as ShapeElement).width;
        origH = (el as ShapeElement).height;
      }
      const w = origW * el.scaleX;
      const h = origH * el.scaleY;

      if (clickX >= el.x && clickX <= el.x + w && clickY >= el.y && clickY <= el.y + h) {
        hit = el;
        transformRef.current = {
          mode: 'move',
          startX: clickX,
          startY: clickY,
          elementStart: { x: el.x, y: el.y, scaleX: el.scaleX, scaleY: el.scaleY, rotation: el.rotation, w, h, originalWidth: origW, originalHeight: origH },
        };
        break;
      }
    }

    if (hit) {
      setSelectedId(hit.id);
    } else {
      setSelectedId(null);
      transformRef.current.mode = 'none';
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / zoomLevel;
    const currentY = (e.clientY - rect.top) / zoomLevel;

    const { mode, startX, startY, elementStart } = transformRef.current;

    // Hover cursor updates
    if (mode === 'none') {
      if (selectedId) {
        const selected = elements.find((el) => el.id === selectedId);
        if (selected && !selected.locked) {
          let origW = 100;
          let origH = 100;
          if (selected.type === 'image') {
            origW = (selected as ImageElement).originalWidth;
            origH = (selected as ImageElement).originalHeight;
          }
          const w = origW * selected.scaleX;
          const h = origH * selected.scaleY;
          const sx = selected.x;
          const sy = selected.y;
          const hr = 10;
          if ((Math.abs(currentX - (sx + w)) <= hr && Math.abs(currentY - (sy + h)) <= hr) ||
              (Math.abs(currentX - sx) <= hr && Math.abs(currentY - sy) <= hr)) {
            canvas.style.cursor = 'nwse-resize';
            return;
          }
          if ((Math.abs(currentX - sx) <= hr && Math.abs(currentY - (sy + h)) <= hr) ||
              (Math.abs(currentX - (sx + w)) <= hr && Math.abs(currentY - sy) <= hr)) {
            canvas.style.cursor = 'nesw-resize';
            return;
          }
          if (Math.abs(currentX - (sx + w / 2)) <= hr && Math.abs(currentY - (sy - 22)) <= hr) {
            canvas.style.cursor = 'crosshair';
            return;
          }
          if (currentX >= sx && currentX <= sx + w && currentY >= sy && currentY <= sy + h) {
            canvas.style.cursor = 'move';
            return;
          }
        }
      }
      canvas.style.cursor = 'default';
      return;
    }

    const dx = currentX - startX;
    const dy = currentY - startY;

    if (mode === 'move') {
      let nextX = Math.round(elementStart.x + dx);
      let nextY = Math.round(elementStart.y + dy);

      // Snap to center within 5px
      const centerX = Math.round(canvasWidthPx / 2 - elementStart.w / 2);
      const centerY = Math.round(canvasHeightPx / 2 - elementStart.h / 2);
      if (Math.abs(nextX - centerX) < 5) nextX = centerX;
      if (Math.abs(nextY - centerY) < 5) nextY = centerY;

      setElements((prev) =>
        prev.map((el) => (el.id === selectedId ? { ...el, x: nextX, y: nextY } : el))
      );
    } else if (mode === 'resize-se') {
      const newW = Math.max(25, elementStart.w + dx);
      const newScale = Number((newW / elementStart.originalWidth).toFixed(3));
      setElements((prev) =>
        prev.map((el) =>
          el.id === selectedId
            ? {
                ...el,
                scaleX: newScale,
                scaleY: newScale,
                ...(el.type === 'image'
                  ? { currentDpi: Math.round(elementStart.originalWidth / (((elementStart.originalWidth * newScale) / scalePxPerMm) / 25.4)) }
                  : {}),
              }
            : el
        )
      );
    } else if (mode === 'resize-sw') {
      const newW = Math.max(25, elementStart.w - dx);
      const newScale = Number((newW / elementStart.originalWidth).toFixed(3));
      const newX = elementStart.x + (elementStart.w - newW);
      setElements((prev) =>
        prev.map((el) =>
          el.id === selectedId
            ? {
                ...el,
                x: Math.round(newX),
                scaleX: newScale,
                scaleY: newScale,
                ...(el.type === 'image'
                  ? { currentDpi: Math.round(elementStart.originalWidth / (((elementStart.originalWidth * newScale) / scalePxPerMm) / 25.4)) }
                  : {}),
              }
            : el
        )
      );
    } else if (mode === 'resize-ne') {
      const newW = Math.max(25, elementStart.w + dx);
      const newScale = Number((newW / elementStart.originalWidth).toFixed(3));
      const newH = elementStart.originalHeight * newScale;
      const newY = elementStart.y + (elementStart.h - newH);
      setElements((prev) =>
        prev.map((el) =>
          el.id === selectedId
            ? {
                ...el,
                y: Math.round(newY),
                scaleX: newScale,
                scaleY: newScale,
                ...(el.type === 'image'
                  ? { currentDpi: Math.round(elementStart.originalWidth / (((elementStart.originalWidth * newScale) / scalePxPerMm) / 25.4)) }
                  : {}),
              }
            : el
        )
      );
    } else if (mode === 'resize-nw') {
      const newW = Math.max(25, elementStart.w - dx);
      const newScale = Number((newW / elementStart.originalWidth).toFixed(3));
      const newH = elementStart.originalHeight * newScale;
      const newX = elementStart.x + (elementStart.w - newW);
      const newY = elementStart.y + (elementStart.h - newH);
      setElements((prev) =>
        prev.map((el) =>
          el.id === selectedId
            ? {
                ...el,
                x: Math.round(newX),
                y: Math.round(newY),
                scaleX: newScale,
                scaleY: newScale,
                ...(el.type === 'image'
                  ? { currentDpi: Math.round(elementStart.originalWidth / (((elementStart.originalWidth * newScale) / scalePxPerMm) / 25.4)) }
                  : {}),
              }
            : el
        )
      );
    } else if (mode === 'rotate') {
      const centerX = elementStart.x + elementStart.w / 2;
      const centerY = elementStart.y + elementStart.h / 2;
      let angle = Math.round((Math.atan2(currentY - centerY, currentX - centerX) * 180) / Math.PI) + 90;
      angle = (angle + 360) % 360;
      setElements((prev) =>
        prev.map((el) => (el.id === selectedId ? { ...el, rotation: angle } : el))
      );
    }

    setRenderTick((t) => t + 1);
  };

  const handleMouseUp = () => {
    if (transformRef.current.mode !== 'none') {
      transformRef.current.mode = 'none';
      pushHistory(elements);
    }
  };

  // Save Calibrated Template
  const handleSaveCalibration = async () => {
    if (!selectedModel) return;

    const updatedTemplate = {
      ...template,
      widthMm: tempWidthMm,
      heightMm: tempHeightMm,
      cornerRadiusMm: tempRadiusMm,
      bleedMm: tempBleedMm,
    };

    const updatedModel: DeviceModel = {
      ...selectedModel,
      status: 'active',
      template: updatedTemplate,
    };

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedModel),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedModel(updatedModel);
        setAllModels((prev) => prev.map((m) => (m.id === updatedModel.id ? updatedModel : m)));
        setCalibratorOpen(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Generate Master 300 DPI Full-Resolution Industrial Composite
  const generateMaster300DpiComposite = (): string => {
    // Exact 300 DPI: 300 dots per 25.4 mm = 11.8110236 px per mm
    const dpi = 300;
    const targetPxPerMm = dpi / 25.4;
    const exportWidthPx = Math.round(totalWidthMm * targetPxPerMm);
    const exportHeightPx = Math.round(totalHeightMm * targetPxPerMm);

    const offscreen = document.createElement('canvas');
    offscreen.width = exportWidthPx;
    offscreen.height = exportHeightPx;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return canvasRef.current?.toDataURL('image/png') || '';

    // Maximum rendering quality & color preservation
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 1. Background fill
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, exportWidthPx, exportHeightPx);

    // Multiplier ratio from editor screen space to 300 DPI physical print space
    const ratio = targetPxPerMm / scalePxPerMm;

    // 2. Render all elements using their original high-resolution assets
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);

    for (const el of sorted) {
      if (el.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = el.opacity;

      // Translate to high-res coordinates
      ctx.translate(el.x * ratio, el.y * ratio);
      if (el.rotation) {
        ctx.rotate((el.rotation * Math.PI) / 180);
      }
      ctx.scale(el.scaleX * ratio, el.scaleY * ratio);

      if (el.type === 'image') {
        const img = loadedImagesRef.current.get(el.src);
        if (img && img.complete && img.naturalWidth > 0) {
          const f = el.filters || {};
          const filterParts: string[] = [];
          if (f.brightness !== undefined && f.brightness !== 100) filterParts.push(`brightness(${f.brightness}%)`);
          if (f.contrast !== undefined && f.contrast !== 100) filterParts.push(`contrast(${f.contrast}%)`);
          if (f.saturation !== undefined && f.saturation !== 100) filterParts.push(`saturate(${f.saturation}%)`);
          if (f.grayscale) filterParts.push('grayscale(100%)');
          if (f.sepia) filterParts.push('sepia(100%)');
          if (f.blur) filterParts.push(`blur(${f.blur * ratio}px)`);
          ctx.filter = filterParts.length > 0 ? filterParts.join(' ') : 'none';

          ctx.save();
          if (f.flipX || f.flipY) {
            ctx.translate(f.flipX ? el.originalWidth : 0, f.flipY ? el.originalHeight : 0);
            ctx.scale(f.flipX ? -1 : 1, f.flipY ? -1 : 1);
          }
          // Draw ORIGINAL high-resolution photo directly (e.g. 3000x4000px)!
          ctx.drawImage(img, 0, 0, el.originalWidth, el.originalHeight);
          ctx.restore();
          ctx.filter = 'none';
        }
      } else if (el.type === 'text') {
        ctx.font = `${el.bold ? 'bold ' : ''}${Math.round(el.fontSize * ratio)}px '${el.fontFamily}', sans-serif`;
        ctx.fillStyle = el.fill;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';

        if (el.stroke && el.strokeWidth) {
          ctx.strokeStyle = el.stroke;
          ctx.lineWidth = el.strokeWidth * ratio;
          ctx.strokeText(el.text, 0, 0);
        }
        ctx.fillText(el.text, 0, 0);
      } else if (el.type === 'shape') {
        ctx.fillStyle = el.fill;
        if (el.shapeType === 'circle') {
          ctx.beginPath();
          ctx.arc(
            (el.width * ratio) / 2,
            (el.height * ratio) / 2,
            (el.width * ratio) / 2,
            0,
            Math.PI * 2
          );
          ctx.fill();
        } else if (el.shapeType === 'rect') {
          ctx.fillRect(0, 0, el.width * ratio, el.height * ratio);
        }
      }

      ctx.restore();
    }

    return offscreen.toDataURL('image/png', 1.0);
  };

  // Instant 1-Click Production Export
  const handleInstantProductionExport = async (override: boolean = false) => {
    if (!selectedModel) return;

    setIsExporting(true);
    setExportError(null);
    setExportModalOpen(true);

    try {
      // Generate true 300 DPI composite from original high-resolution assets
      const previewDataUrl = generateMaster300DpiComposite();

      const designData: DesignData = {
        canvasWidthPx,
        canvasHeightPx,
        pxPerMm: scalePxPerMm,
        elements,
        backgroundColor,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: selectedModel.id,
          designData,
          previewDataUrl,
          customerName: 'أمر تشغيل الورشة',
          customerPhone: 'الإنتاج الداخلي',
          forceExport: true,
          printOptions: {
            technology: printTechnology,
            caseType,
            mirrorForSublimation: isMirroredPreview || printTechnology === 'sublimation',
            generateWhiteUnderbase: caseType === 'tpu_clear' || printTechnology === 'uv',
            sublimationHeatCompensation: heatCompensation,
            registrationMarks,
            includeBleedSlugText: includeBleedSlug,
            includeDieLineOverlay: includeDieLineOnPrint,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setExportError(data.errorAr || data.error || 'فحص جودة الطباعة لم يكتمل');
        setIsExporting(false);
        return;
      }

      setExportResult(data);
    } catch (err: any) {
      setExportError(err.message || 'خطأ في الاتصال بالخادم');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAllExportFiles = () => {
    if (!exportResult?.files) return;
    const fileEntries = [
      exportResult.files.pdfUrl,
      exportResult.files.proofPdfUrl,
      exportResult.files.pngUrl,
      exportResult.files.cutSvgUrl,
      exportResult.files.jobTicketUrl,
      exportResult.files.whiteUnderbaseUrl,
    ].filter(Boolean);

    fileEntries.forEach((url: string, index: number) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = `/api/download?file=${encodeURIComponent(url)}`;
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, index * 400);
    });
  };

  // Filter models in search drawer
  const filteredSearchModels = allModels.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesQ =
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.aliases?.some((a) => a.toLowerCase().includes(q));

    const matchesBrand = brandFilter === 'all' || m.brandId.toLowerCase() === brandFilter.toLowerCase();

    let matchesYear = true;
    if (yearFilter === '2024-2026') matchesYear = m.releaseYear >= 2024;
    else if (yearFilter === '2021-2023') matchesYear = m.releaseYear >= 2021 && m.releaseYear <= 2023;
    else if (yearFilter === '2018-2020') matchesYear = m.releaseYear >= 2018 && m.releaseYear <= 2020;

    return matchesQ && matchesBrand && matchesYear;
  });

  const selectedImageDpi =
    selectedElement && selectedElement.type === 'image'
      ? calculateDpi(selectedElement as ImageElement)
      : null;

  return (
    <div className="flex-1 flex flex-col bg-[#F4F2ED] text-[#141413] font-sans select-none min-h-[calc(100vh-53px)]">
      {/* =========================================================================
          TOP INDUSTRIAL HEADER & HUD BAR
         ========================================================================= */}
      <div className="bg-[#FBFBF9] border-b border-[#D4D1C7] px-4 py-2 flex flex-wrap items-center justify-between gap-3 z-30">
        {/* Left: Device Switcher Button & Physical Dimensions HUD */}
        <div className="flex items-center gap-2.5">
          {/* Quick Spotlight Switcher Trigger */}
          <button
            onClick={() => setDeviceSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-[#F4F2ED] border border-[#D4D1C7] text-right group transition-all shadow-sm"
            title="اضغط للبحث في أكثر من 397 موديل هاتف مدعوم"
          >
            <Smartphone className="w-4 h-4 text-[#141413]" />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs sm:text-sm text-[#141413]">
                  {selectedModel?.name || 'اختر موديل الهاتف...'}
                </span>
                <span className="text-[10px] font-mono-num px-1.5 py-0.2 bg-[#ECE9E1] text-[#4F4D46] border border-[#D4D1C7]">
                  {selectedModel?.releaseYear}
                </span>
              </div>
              <p className="text-[10px] text-[#5A5850] font-mono-num">
                {trimWidthMm} × {trimHeightMm} مم (Bleed: +{bleedMm}مم)
              </p>
            </div>
            <Search className="w-3.5 h-3.5 text-[#827F75] mr-1 group-hover:text-[#141413]" />
          </button>

          {/* Quick Calibrate / Die-line Adjuster Button */}
          <button
            onClick={() => setCalibratorOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-[#FBFBF9] hover:bg-[#ECE9E1] text-[#4F4D46] hover:text-[#141413] text-xs font-semibold border border-[#D4D1C7] transition-colors"
            title="تعديل أبعاد الجراب بالملليمتر يدوياً إذا كان لديك مقاس مختلف"
          >
            <Ruler className="w-3.5 h-3.5 text-[#15803D]" />
            <span className="font-mono-num">معايرة المقاس ({trimWidthMm}×{trimHeightMm}مم)</span>
          </button>
        </div>

        {/* Center / Right: Live DPI Badge, Undo/Redo & Direct 1-Click Print Export */}
        <div className="flex items-center gap-2.5">
          {/* Live DPI Status Pill */}
          {selectedImageDpi !== null ? (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold border font-mono-num transition-all ${
                selectedImageDpi >= 300
                  ? 'bg-[#F0FDF4] text-[#15803D] border-[#86EFAC]'
                  : selectedImageDpi >= 200
                  ? 'bg-[#FEFCE8] text-[#A16207] border-[#FDE047]'
                  : 'bg-[#FEF2F2] text-[#B91C1C] border-[#FCA5A5]'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>دقة الصورة: {selectedImageDpi} DPI {selectedImageDpi >= 300 ? '✓ ممتازة' : '⚠️ أقل من 300'}</span>
            </div>
          ) : (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono-num text-[#4F4D46] bg-[#ECE9E1] border border-[#D4D1C7]">
              <span className="w-2 h-2 rounded-full bg-[#15803D] inline-block"></span>
              <span>جاهز للطباعة 300 DPI</span>
            </div>
          )}

          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5 bg-white p-0.5 border border-[#D4D1C7]">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-1 text-[#4F4D46] hover:text-[#141413] disabled:opacity-30 transition-colors"
              title="تراجع (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-1 text-[#4F4D46] hover:text-[#141413] disabled:opacity-30 transition-colors"
              title="إعادة (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Instant Client-side 1-click PNG Download */}
          <button
            onClick={downloadCanvasAsPng}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#ECE9E1] hover:bg-[#D4D1C7] text-[#141413] text-xs font-bold border border-[#D4D1C7] transition-all shadow-sm"
            title="تحميل صورة الكفر فوراً بدقة 300 DPI على جهازك"
          >
            <Download className="w-3.5 h-3.5 text-[#141413]" />
            <span>حفظ PNG فوراً</span>
          </button>

          {/* Instant 1-Click Production Export (PDF/X + CUT + PNG) */}
          <button
            onClick={() => handleInstantProductionExport(true)}
            className="px-4 py-1.5 bg-[#141413] hover:bg-[#282725] text-white font-bold text-xs sm:text-sm flex items-center gap-2 border border-[#141413] shadow-sm transition-all"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>تصدير حزمة الطباعة (PDF/X + CUT)</span>
          </button>
        </div>
      </div>

      {/* Visitor Mobile Auto-Detection Banner */}
      {detectedPhoneName && selectedModel?.name !== detectedPhoneName && (
        <div className="bg-[#FEFCE8] border-b border-[#FDE047] px-4 py-1.5 text-xs text-[#854D0E] flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-[#A16207]" />
            <span>
              يبدو أنك تتصفح من جهاز <strong>{detectedPhoneName}</strong> - هل تود التصميم له مباشرة؟
            </span>
          </div>
          <button
            onClick={() => {
              const target = allModels.find(
                (m) => m.id === detectedModelId || m.name.toLowerCase().includes((detectedPhoneName || '').toLowerCase())
              );
              if (target) handleSelectModel(target);
            }}
            className="px-2.5 py-0.5 bg-[#854D0E] text-white font-bold text-[11px] hover:bg-[#713F12] transition-colors"
          >
            تطبيق الموديل فوراً
          </button>
        </div>
      )}

      {/* Industrial Workshop Production Bar */}
      <div className="bg-[#ECE9E1] border-b border-[#D4D1C7] px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs z-20">
        {/* Left: Printing Technology & Case Material Selectors */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Technology */}
          <div className="flex items-center gap-1.5 bg-white px-2 py-1 border border-[#D4D1C7]">
            <Printer className="w-3.5 h-3.5 text-[#141413]" />
            <span className="font-bold text-[11px] text-[#5A5850]">الماكينة:</span>
            <select
              value={printTechnology}
              onChange={(e) => {
                const tech = e.target.value as any;
                setPrintTechnology(tech);
              }}
              className="bg-transparent font-bold text-xs text-[#141413] outline-none cursor-pointer"
            >
              <option value="sublimation">سبليميشن حراري (معكوس أوتوماتيك)</option>
              <option value="uv">UV فلات بيد مباشر (طبقة أبيض)</option>
              <option value="dtf">DTF فينيل ناقل</option>
            </select>
          </div>

          {/* Case Profile / Die-line type */}
          <div className="flex items-center gap-1.5 bg-white px-2 py-1 border border-[#D4D1C7]">
            <Smartphone className="w-3.5 h-3.5 text-[#141413]" />
            <span className="font-bold text-[11px] text-[#5A5850]">الخامة:</span>
            <select
              value={caseType}
              onChange={(e) => setCaseType(e.target.value as any)}
              className="bg-transparent font-bold text-xs text-[#141413] outline-none cursor-pointer"
            >
              <option value="2d_flat">2D مسطح (Bleed 3mm)</option>
              <option value="3d_wrap">3D مجسم يلتف على الجوانب (Bleed 12mm)</option>
              <option value="tpu_clear">TPU شفاف (مع طبقة أبيض تحتية)</option>
              <option value="hard_pc">Hard PC صلب</option>
            </select>
          </div>

          {/* Live Horizontal Mirror Toggle Button */}
          <button
            onClick={() => setIsMirroredPreview(!isMirroredPreview)}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs font-bold border transition-all ${
              isMirroredPreview
                ? 'bg-[#B91C1C] text-white border-[#991B1B]'
                : 'bg-white hover:bg-[#F4F2ED] text-[#141413] border-[#D4D1C7]'
            }`}
            title="قلب التصميم أفقياً للمعاينة الحية لورق السبليميشن الحراري"
          >
            <span>⇄</span>
            <span>{isMirroredPreview ? 'معكوس سبليميشن (نشط)' : 'عكس مرآة (Mirror)'}</span>
          </button>

          {/* Die-Line Print Overlay Toggle */}
          <button
            onClick={() => setIncludeDieLineOnPrint(!includeDieLineOnPrint)}
            className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold border transition-all ${
              includeDieLineOnPrint
                ? 'bg-[#FEF3C7] text-[#92400E] border-[#F59E0B]'
                : 'bg-white hover:bg-[#F4F2ED] text-[#5A5850] border-[#D4D1C7]'
            }`}
            title="تضمين خطوط القص والتفريغ فوق صورة الطباعة (مفيد للتجارب فقط، اتركه معطلاً للطباعة الإنتاجية النظيفة)"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{includeDieLineOnPrint ? 'خطوط الداي لاين: مطبوعة' : 'طباعة نظيفة (بدون خطوط)'}</span>
          </button>
        </div>

        {/* Right: Advanced Workshop Studio Actions */}
        <div className="flex items-center gap-2">
          {/* 3D Realistic Mockup Preview */}
          <button
            onClick={() => setIs3dMockupOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#F4F2ED] text-[#141413] text-xs font-bold border border-[#D4D1C7] transition-all shadow-sm"
            title="معاينة شكل الجراب الحقيقي مجسماً 3D على الهاتف"
          >
            <Box className="w-3.5 h-3.5 text-[#1D4ED8]" />
            <span>معاينة 3D الواقعية</span>
          </button>

          {/* Customer Approval Proof Sheet */}
          <button
            onClick={generateCustomerProof}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#F4F2ED] text-[#141413] text-xs font-bold border border-[#D4D1C7] transition-all shadow-sm"
            title="توليد بروفة اعتماد مائية للعميل لمشاركتها على واتساب"
          >
            <Share2 className="w-3.5 h-3.5 text-[#15803D]" />
            <span>بروفة العميل (WhatsApp)</span>
          </button>

          {/* Gang Sheet Optimizer (A3) */}
          <button
            onClick={() => setGangSheetModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[#141413] hover:bg-[#282725] text-white text-xs font-bold border border-[#141413] transition-all shadow-sm"
            title="تجميع 6 إلى 8 كفرات على فرخ A3 واحد لتوفير 60% من الورق والحبر"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#FDE047]" />
            <span>فرخ تجميع A3 (وفر 60%)</span>
          </button>
        </div>
      </div>

      {/* Real-time Camera Cutout Collision Warning Banner */}
      {cutoutCollisionWarning && (
        <div className="bg-[#FEF2F2] border-b border-[#FCA5A5] px-4 py-1.5 text-xs text-[#991B1B] flex items-center justify-between font-bold z-20">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#B91C1C] shrink-0" />
            <span>{cutoutCollisionWarning}</span>
          </div>
          <button
            onClick={() => setCutoutCollisionWarning(null)}
            className="text-[11px] underline hover:no-underline text-[#B91C1C]"
          >
            إخفاء
          </button>
        </div>
      )}

      {/* =========================================================================
          MAIN WORKSPACE: 70% CANVAS ON LEFT + 30% TOOLS ON RIGHT
         ========================================================================= */}
      <div className="flex-1 flex flex-col lg:flex-row relative overflow-hidden h-[calc(100vh-53px)]">
        {/* =====================================================================
            RIGHT: WORKSHOP CONTROL RACK & TOOLS (30%)
           ===================================================================== */}
        <aside className="w-full lg:w-[380px] lg:min-w-[380px] lg:max-w-[380px] shrink-0 bg-[#FBFBF9] border-b lg:border-b-0 lg:border-l border-[#D4D1C7] flex flex-col z-20 h-full overflow-hidden">
          {/* Tool Tabs */}
          <div className="grid grid-cols-6 bg-[#ECE9E1] border-b border-[#D4D1C7] text-xs font-medium">
            <button
              onClick={() => setActiveTool('upload')}
              className={`py-2.5 px-0.5 flex flex-col items-center gap-1 transition-colors border-l border-[#D4D1C7] ${
                activeTool === 'upload' ? 'bg-[#FBFBF9] text-[#141413] font-bold border-b-2 border-b-[#141413]' : 'text-[#5A5850] hover:text-[#141413]'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span className="text-[11px]">الصور</span>
            </button>
            <button
              onClick={() => setActiveTool('collage')}
              className={`py-2.5 px-0.5 flex flex-col items-center gap-1 transition-colors border-l border-[#D4D1C7] ${
                activeTool === 'collage' ? 'bg-[#FBFBF9] text-[#141413] font-bold border-b-2 border-b-[#141413]' : 'text-[#5A5850] hover:text-[#141413]'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span className="text-[11px]">قوالب</span>
            </button>
            <button
              onClick={() => setActiveTool('text')}
              className={`py-2.5 px-0.5 flex flex-col items-center gap-1 transition-colors border-l border-[#D4D1C7] ${
                activeTool === 'text' ? 'bg-[#FBFBF9] text-[#141413] font-bold border-b-2 border-b-[#141413]' : 'text-[#5A5850] hover:text-[#141413]'
              }`}
            >
              <Type className="w-4 h-4" />
              <span className="text-[11px]">الكتابة</span>
            </button>
            <button
              onClick={() => setActiveTool('shapes')}
              className={`py-2.5 px-0.5 flex flex-col items-center gap-1 transition-colors border-l border-[#D4D1C7] ${
                activeTool === 'shapes' ? 'bg-[#FBFBF9] text-[#141413] font-bold border-b-2 border-b-[#141413]' : 'text-[#5A5850] hover:text-[#141413]'
              }`}
            >
              <Shapes className="w-4 h-4" />
              <span className="text-[11px]">أشكال</span>
            </button>
            <button
              onClick={() => setActiveTool('adjust')}
              className={`py-2.5 px-0.5 flex flex-col items-center gap-1 transition-colors border-l border-[#D4D1C7] ${
                activeTool === 'adjust' ? 'bg-[#FBFBF9] text-[#141413] font-bold border-b-2 border-b-[#141413]' : 'text-[#5A5850] hover:text-[#141413]'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span className="text-[11px]">الضبط</span>
            </button>
            <button
              onClick={() => setActiveTool('layers')}
              className={`py-2.5 px-0.5 flex flex-col items-center gap-1 transition-colors ${
                activeTool === 'layers' ? 'bg-[#FBFBF9] text-[#141413] font-bold border-b-2 border-b-[#141413]' : 'text-[#5A5850] hover:text-[#141413]'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span className="text-[11px]">الطبقات</span>
            </button>
          </div>

          {/* Active Tool Content */}
          <div className="p-4 overflow-y-auto flex-1 overflow-y-auto space-y-4">
            {/* 1. Upload Graphics */}
            {activeTool === 'upload' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-[#5A5850] mb-1.5">
                    رفع صورة التصميم
                  </h4>
                  <label className="border-2 border-dashed border-[#A3A096] hover:border-[#141413] bg-white hover:bg-[#F4F2ED] p-5 text-center cursor-pointer flex flex-col items-center gap-2 transition-all block">
                    <div className="w-9 h-9 bg-[#ECE9E1] text-[#141413] flex items-center justify-center border border-[#D4D1C7]">
                      <Upload className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-[#141413] block">
                        اضغط لاختيار صورة من جهازك
                      </span>
                      <span className="text-[10px] text-[#827F75] block mt-0.5">
                        أو اسحب وأفلت الصورة مباشرة على الكانفاس
                      </span>
                    </div>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>

                {/* PREMIUM IMAGE CONTROLS SUITE */}
                {selectedElement && selectedElement.type === 'image' && (
                  <div className="space-y-3.5 border-t border-[#D4D1C7] pt-3">
                    {/* Specs & Live DPI Card */}
                    <div className="p-3 bg-[#FBFBF9] border border-[#D4D1C7] space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-[#141413]">أبعاد الصورة المطبوعة:</span>
                        <span className="font-mono-num text-[11px] text-[#4F4D46]">
                          {(((selectedElement as ImageElement).originalWidth * selectedElement.scaleX) / scalePxPerMm).toFixed(1)} × {(((selectedElement as ImageElement).originalHeight * selectedElement.scaleY) / scalePxPerMm).toFixed(1)} مم
                        </span>
                      </div>
                      
                      {/* Live DPI Status Meter */}
                      <div className="pt-1">
                        <div className="flex justify-between text-[11px] mb-1 font-mono-num">
                          <span className="text-[#5A5850]">دقة الطباعة الحالية:</span>
                          <span className={`font-bold ${
                            (selectedImageDpi || 300) >= 300 ? 'text-[#15803D]' : (selectedImageDpi || 300) >= 200 ? 'text-[#A16207]' : 'text-[#B91C1C]'
                          }`}>
                            {selectedImageDpi || 300} DPI {(selectedImageDpi || 300) >= 300 ? '✓ ممتازة' : (selectedImageDpi || 300) >= 200 ? '⚠️ مقبولة' : 'ℹ️ متوسطة'}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-[#ECE9E1] overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              (selectedImageDpi || 300) >= 300 ? 'bg-[#15803D]' : (selectedImageDpi || 300) >= 200 ? 'bg-[#EAB308]' : 'bg-[#EF4444]'
                            }`}
                            style={{ width: `${Math.min(100, ((selectedImageDpi || 300) / 300) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 1: Smart Sizing & Quick Fit */}
                    <div className="p-3 bg-white border border-[#D4D1C7] space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#141413] flex items-center gap-1.5">
                          <Maximize2 className="w-3.5 h-3.5 text-[#141413]" />
                          <span>المقاس والملاءمة الذكية:</span>
                        </span>
                        <span className="text-[11px] font-mono-num font-bold text-[#141413]">
                          {Math.round(selectedElement.scaleX * 100)}%
                        </span>
                      </div>

                      {/* 4 One-click Fit Presets */}
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <button
                          onClick={fitImageToBleed}
                          className="p-1.5 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413] font-medium flex items-center justify-center gap-1 text-[11px]"
                          title="تمديد الصورة لتغطي كامل مساحة الجراب وهامش النزيف 3مم"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>تعبئة الكفر كاملاً</span>
                        </button>
                        <button
                          onClick={fitImageToTrim}
                          className="p-1.5 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413] font-medium flex items-center justify-center gap-1 text-[11px]"
                          title="تصغير الصورة لتظهر كاملة داخل حدود الكفر"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>ملاءمة بالداخل</span>
                        </button>
                        <button
                          onClick={centerSelected}
                          className="p-1.5 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413] font-medium flex items-center justify-center gap-1 text-[11px]"
                          title="توسيط الصورة في منتصف الكفر أفقياً ورأسياً"
                        >
                          <AlignCenter className="w-3.5 h-3.5" />
                          <span>توسيط في المنتصف</span>
                        </button>
                        <button
                          onClick={() => {
                            updateSelected((el) => ({ ...el, scaleX: 1, scaleY: 1 }));
                          }}
                          className="p-1.5 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413] font-medium flex items-center justify-center gap-1 text-[11px]"
                          title="استرجاع المقاس الطبيعي 100%"
                        >
                          <Ruler className="w-3.5 h-3.5" />
                          <span>المقاس الأصلي 100%</span>
                        </button>
                      </div>

                      {/* 1-Click Smart Background Remover */}
                      <button
                        onClick={removeImageBackground}
                        className="w-full py-2 bg-white hover:bg-[#F4F2ED] border border-[#D4D1C7] text-xs font-bold text-[#141413] flex items-center justify-center gap-2 transition-all shadow-sm"
                        title="إزالة لون الخلفية تلقائياً وجعلها شفافة لمضاعفة جودة التصميم"
                      >
                        <Wand2 className="w-4 h-4 text-[#7C3AED]" />
                        <span>إزالة الخلفية الذكية بنقرة واحدة (Remove BG)</span>
                      </button>

                      {/* Smooth Step Scale Slider */}
                      <div className="pt-1">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => adjustScaleStep(-0.08)}
                            className="p-1 bg-[#ECE9E1] hover:bg-[#D4D1C7] border border-[#D4D1C7] text-[#141413]"
                            title="تصغير تدريجي"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="range"
                            min="0.1"
                            max="3.5"
                            step="0.02"
                            value={selectedElement.scaleX}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateSelected((el) => ({
                                ...el,
                                scaleX: val,
                                scaleY: val,
                                ...(el.type === 'image'
                                  ? { currentDpi: Math.round((el as ImageElement).originalWidth / ((( (el as ImageElement).originalWidth * val) / scalePxPerMm) / 25.4)) }
                                  : {}),
                              }));
                            }}
                            className="flex-1 accent-[#141413]"
                          />
                          <button
                            onClick={() => adjustScaleStep(0.08)}
                            className="p-1 bg-[#ECE9E1] hover:bg-[#D4D1C7] border border-[#D4D1C7] text-[#141413]"
                            title="تكبير تدريجي"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Rotation & Flip */}
                    <div className="p-3 bg-white border border-[#D4D1C7] space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-[#141413] flex items-center gap-1.5">
                          <RotateCw className="w-3.5 h-3.5 text-[#141413]" />
                          <span>التدوير والانعكاس:</span>
                        </span>
                        <span className="text-[11px] font-mono-num font-bold text-[#141413]">
                          {selectedElement.rotation}°
                        </span>
                      </div>

                      {/* 4 Transform Buttons */}
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <button
                          onClick={rotateSelected90}
                          className="p-1.5 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413] font-medium flex items-center justify-center gap-1 text-[11px]"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                          <span>90° يمين ↷</span>
                        </button>
                        <button
                          onClick={rotateSelectedMinus90}
                          className="p-1.5 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413] font-medium flex items-center justify-center gap-1 text-[11px]"
                        >
                          <RotateCw className="w-3.5 h-3.5 -scale-x-100" />
                          <span>90° يسار ↶</span>
                        </button>
                        <button
                          onClick={toggleFlipX}
                          className="p-1.5 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413] font-medium flex items-center justify-center gap-1 text-[11px]"
                          title="قلب الصورة أفقياً"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>انعكاس أفقي ⇄</span>
                        </button>
                        <button
                          onClick={toggleFlipY}
                          className="p-1.5 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413] font-medium flex items-center justify-center gap-1 text-[11px]"
                          title="قلب الصورة رأسياً"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>انعكاس رأسي ⇅</span>
                        </button>
                      </div>

                      {/* Rotation Slider */}
                      <div>
                        <input
                          type="range"
                          min="0"
                          max="360"
                          step="1"
                          value={selectedElement.rotation}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            updateSelected((el) => ({ ...el, rotation: val }));
                          }}
                          className="w-full accent-[#141413]"
                        />
                      </div>
                    </div>

                    {/* Section 3: Professional Photo Filters & Color Tuning */}
                    <div className="p-3 bg-white border border-[#D4D1C7] space-y-2.5">
                      <span className="text-xs font-bold text-[#141413] flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-[#141413]" />
                        <span>استوديو الألوان والإضاءة (PRO):</span>
                      </span>

                      {/* 5 One-click Presets */}
                      <div className="grid grid-cols-3 gap-1 text-[11px]">
                        <button
                          onClick={() => applyFilterPreset('normal')}
                          className="py-1 px-1 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413]"
                        >
                          🎨 أصلية
                        </button>
                        <button
                          onClick={() => applyFilterPreset('bw')}
                          className="py-1 px-1 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413]"
                        >
                          🖤 أبيض وأسود
                        </button>
                        <button
                          onClick={() => applyFilterPreset('warm')}
                          className="py-1 px-1 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413]"
                        >
                          ☕ دافئ
                        </button>
                        <button
                          onClick={() => applyFilterPreset('vibrant')}
                          className="py-1 px-1 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413]"
                        >
                          ⚡ نيون
                        </button>
                        <button
                          onClick={() => applyFilterPreset('dramatic')}
                          className="py-1 px-1 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413]"
                        >
                          🌙 سينمائي
                        </button>
                      </div>

                      {/* Brightness Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-[#5A5850]">
                          <span className="flex items-center gap-1">
                            <Sun className="w-3 h-3" />
                            <span>السطوع (الإضاءة):</span>
                          </span>
                          <span className="font-mono-num">{((selectedElement as ImageElement).filters?.brightness ?? 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="160"
                          step="2"
                          value={(selectedElement as ImageElement).filters?.brightness ?? 100}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            updateSelected((el) => ({
                              ...el,
                              filters: { ...((el as ImageElement).filters || {}), brightness: val },
                            }));
                          }}
                          className="w-full accent-[#141413]"
                        />
                      </div>

                      {/* Contrast Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-[#5A5850]">
                          <span className="flex items-center gap-1">
                            <Contrast className="w-3 h-3" />
                            <span>التباين (Contrast):</span>
                          </span>
                          <span className="font-mono-num">{((selectedElement as ImageElement).filters?.contrast ?? 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="170"
                          step="2"
                          value={(selectedElement as ImageElement).filters?.contrast ?? 100}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            updateSelected((el) => ({
                              ...el,
                              filters: { ...((el as ImageElement).filters || {}), contrast: val },
                            }));
                          }}
                          className="w-full accent-[#141413]"
                        />
                      </div>

                      {/* Saturation Slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-[#5A5850]">
                          <span>تشبع الألوان:</span>
                          <span className="font-mono-num">{((selectedElement as ImageElement).filters?.saturation ?? 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="200"
                          step="5"
                          value={(selectedElement as ImageElement).filters?.saturation ?? 100}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            updateSelected((el) => ({
                              ...el,
                              filters: { ...((el as ImageElement).filters || {}), saturation: val },
                            }));
                          }}
                          className="w-full accent-[#141413]"
                        />
                      </div>
                    </div>

                    {/* Section 4: Opacity */}
                    <div className="p-3 bg-white border border-[#D4D1C7] space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-[#141413]">
                        <span>الشفافية:</span>
                        <span className="font-mono-num">{Math.round(selectedElement.opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={selectedElement.opacity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateSelected((el) => ({ ...el, opacity: val }));
                        }}
                        className="w-full accent-[#141413]"
                      />
                    </div>

                    {/* Section 5: Layer Management & Duplicate */}
                    <div className="p-3 bg-white border border-[#D4D1C7] space-y-2">
                      <span className="text-xs font-bold text-[#141413] block">
                        إجراءات الطبقة:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 text-xs">
                        <button
                          onClick={duplicateSelected}
                          className="p-1.5 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413] flex items-center justify-center gap-1 font-medium"
                          title="إنشاء نسخة مطابقة من الصورة"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>تكرار (Duplicate)</span>
                        </button>
                        <button
                          onClick={sendSelectedToBack}
                          className="p-1.5 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413] flex items-center justify-center gap-1 font-medium"
                          title="إرسال الصورة كأرضية خلف باقي العناصر"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                          <span>إرسال للخلفية</span>
                        </button>
                        <button
                          onClick={bringSelectedToFront}
                          className="p-1.5 bg-[#F4F2ED] hover:bg-[#ECE9E1] border border-[#D4D1C7] text-[#141413] flex items-center justify-center gap-1 font-medium"
                          title="تقديم الصورة للأمام"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                          <span>تقديم للأمام</span>
                        </button>
                        <button
                          onClick={() => {
                            const updated = elements.filter((el) => el.id !== selectedId);
                            setElements(updated);
                            setSelectedId(null);
                            pushHistory(updated);
                            setRenderTick((t) => t + 1);
                          }}
                          className="p-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FCA5A5] text-[#B91C1C] flex items-center justify-center gap-1 font-medium"
                          title="حذف الصورة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف الصورة</span>
                        </button>
                      </div>

                      {/* Direct Instant PNG Download button */}
                      <button
                        onClick={downloadCanvasAsPng}
                        className="w-full py-2 bg-[#141413] hover:bg-[#282725] text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-[#141413] shadow-sm mt-1 transition-all"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>تحميل صورة الكفر فوراً (PNG 300 DPI)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Case Base Color */}
                <div className="pt-2 border-t border-[#D4D1C7]">
                  <span className="text-xs font-bold text-[#141413] mb-2 block">لون أرضية الجراب:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-8 h-8 cursor-pointer border border-[#D4D1C7] bg-transparent p-0"
                    />
                    <div className="flex gap-1.5">
                      {['#ffffff', '#141413', '#ECE9E1', '#C22915', '#1D4ED8', '#15803D', '#D97706'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setBackgroundColor(c)}
                          style={{ backgroundColor: c }}
                          className="w-6 h-6 border border-[#D4D1C7] hover:scale-110 transition-transform"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Text */}
            {activeTool === 'text' && (
              <div className="space-y-3.5">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#5A5850]">إدراج نص عربي أو إنجليزي</h4>
                <div>
                  <label className="text-[11px] text-[#5A5850] mb-1 block">محتوى النص:</label>
                  <input
                    type="text"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="اكتب النص المراد طباعته..."
                    className="w-full px-3 py-1.5 bg-white border border-[#D4D1C7] text-[#141413] text-xs focus:outline-none focus:border-[#141413]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-[#5A5850] mb-1 block">نوع الخط:</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-[#D4D1C7] text-[#141413] text-xs"
                    >
                      <option value="IBM Plex Sans Arabic">IBM Plex Sans Arabic</option>
                      <option value="Cairo">Cairo (كايرو)</option>
                      <option value="Tajawal">Tajawal (تجوال)</option>
                      <option value="Amiri">Amiri (أميري)</option>
                      <option value="Arial">Arial</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#5A5850] mb-1 block">الحجم (pt):</label>
                    <input
                      type="number"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      min="10"
                      max="140"
                      className="w-full px-2 py-1.5 bg-white border border-[#D4D1C7] text-[#141413] text-xs font-mono-num"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-[#5A5850] mb-1 block">لون النص:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-8 h-8 cursor-pointer border border-[#D4D1C7] bg-transparent p-0"
                    />
                    <div className="flex gap-1.5">
                      {['#141413', '#ffffff', '#C22915', '#1D4ED8', '#15803D', '#D97706'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setTextColor(c)}
                          style={{ backgroundColor: c }}
                          className="w-6 h-6 border border-[#D4D1C7]"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAddText}
                  className="w-full py-2 bg-[#141413] hover:bg-[#282725] text-white font-bold text-xs flex items-center justify-center gap-1.5 border border-[#141413] transition-colors"
                >
                  <Type className="w-3.5 h-3.5" />
                  <span>إدراج النص على الكانفاس</span>
                </button>
              </div>
            )}

            {/* 3. Shapes */}
            {activeTool === 'shapes' && (
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#5A5850]">إضافة أشكال هندسية</h4>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleAddShape('rect')}
                    className="p-3 bg-white border border-[#D4D1C7] hover:border-[#141413] flex flex-col items-center gap-1.5 text-[11px] text-[#141413]"
                  >
                    <div className="w-6 h-6 bg-[#141413]"></div>
                    <span>مستطيل</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('circle')}
                    className="p-3 bg-white border border-[#D4D1C7] hover:border-[#141413] flex flex-col items-center gap-1.5 text-[11px] text-[#141413]"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#141413]"></div>
                    <span>دائرة</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('heart')}
                    className="p-3 bg-white border border-[#D4D1C7] hover:border-[#141413] flex flex-col items-center gap-1.5 text-[11px] text-[#141413]"
                  >
                    <Sparkles className="w-5 h-5 text-[#C22915]" />
                    <span>قلب</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. Adjust Selected */}
            {activeTool === 'adjust' && (
              <div className="space-y-3">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#5A5850]">خصائص العنصر المحدد</h4>
                {selectedElement ? (
                  <div className="space-y-3">
                    <div className="text-[11px] text-[#5A5850] flex justify-between items-center pb-2 border-b border-[#D4D1C7]">
                      <span className="font-bold text-[#141413]">النوع: {selectedElement.type}</span>
                      <button
                        onClick={() => {
                          const updated = elements.filter((el) => el.id !== selectedId);
                          setElements(updated);
                          setSelectedId(null);
                          pushHistory(updated);
                          setRenderTick((t) => t + 1);
                        }}
                        className="text-[#C22915] hover:underline flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف العنصر</span>
                      </button>
                    </div>

                    {/* Scale */}
                    <div>
                      <div className="flex justify-between text-[11px] text-[#5A5850] mb-1">
                        <span>مقياس التكبير/التصغير:</span>
                        <span className="font-mono-num font-bold text-[#141413]">
                          {selectedElement.scaleX.toFixed(2)}x
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="3.5"
                        step="0.05"
                        value={selectedElement.scaleX}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateSelected((el) => ({ ...el, scaleX: val, scaleY: val }));
                        }}
                        className="w-full accent-[#141413]"
                      />
                    </div>

                    {/* Rotation */}
                    <div>
                      <div className="flex justify-between text-[11px] text-[#5A5850] mb-1">
                        <span>التدوير:</span>
                        <span className="font-mono-num font-bold text-[#141413]">
                          {selectedElement.rotation}°
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="360"
                        step="5"
                        value={selectedElement.rotation}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          updateSelected((el) => ({ ...el, rotation: val }));
                        }}
                        className="w-full accent-[#141413]"
                      />
                    </div>

                    {/* Opacity */}
                    <div>
                      <div className="flex justify-between text-[11px] text-[#5A5850] mb-1">
                        <span>الشفافية:</span>
                        <span className="font-mono-num font-bold text-[#141413]">
                          {Math.round(selectedElement.opacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={selectedElement.opacity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateSelected((el) => ({ ...el, opacity: val }));
                        }}
                        className="w-full accent-[#141413]"
                      />
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#827F75] text-center py-6">
                    اضغط على أي صورة أو نص في الكانفاس لتعديل أبعاده.
                  </p>
                )}
              </div>
            )}

            {/* 5. Layers */}
            {activeTool === 'layers' && (
              <div className="space-y-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-[#5A5850]">
                  قائمة الطبقات ({elements.length})
                </h4>
                {elements.length === 0 ? (
                  <p className="text-xs text-[#827F75] text-center py-6">لا توجد عناصر مضافة بعد.</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...elements]
                      .sort((a, b) => b.zIndex - a.zIndex)
                      .map((el) => (
                        <div
                          key={el.id}
                          onClick={() => setSelectedId(el.id)}
                          className={`p-2 border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            selectedId === el.id
                              ? 'bg-[#ECE9E1] border-[#141413] text-[#141413] font-bold'
                              : 'bg-white border-[#D4D1C7] text-[#5A5850] hover:border-[#827F75]'
                          }`}
                        >
                          <span className="text-xs truncate">
                            {el.type === 'text' ? (el as TextElement).text : el.type === 'image' ? 'صورة' : 'شكل'}
                          </span>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setElements((prev) =>
                                  prev.map((item) =>
                                    item.id === el.id ? { ...item, zIndex: item.zIndex + 1 } : item
                                  )
                                );
                                setRenderTick((t) => t + 1);
                              }}
                              className="p-1 hover:text-[#141413]"
                              title="تقديم للأعلى"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                setElements((prev) =>
                                  prev.map((item) =>
                                    item.id === el.id ? { ...item, zIndex: Math.max(0, item.zIndex - 1) } : item
                                  )
                                );
                                setRenderTick((t) => t + 1);
                              }}
                              className="p-1 hover:text-[#141413]"
                              title="تأخير للأسفل"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => {
                                const next = elements.filter((item) => item.id !== el.id);
                                setElements(next);
                                if (selectedId === el.id) setSelectedId(null);
                                pushHistory(next);
                                setRenderTick((t) => t + 1);
                              }}
                              className="p-1 text-[#C22915] hover:underline"
                              title="حذف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>

        {/* =====================================================================
            LEFT / CENTER: THE WORKBENCH CUTTING MAT & CANVAS (70%)
           ===================================================================== */}
        <main
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="flex-1 min-w-0 h-full overflow-auto flex relative workshop-mat-grid p-4 lg:p-8"
        >
          {/* Top Canvas Viewport HUD */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-2 bg-[#FBFBF9]/95 border border-[#D4D1C7] px-2.5 py-1 text-xs text-[#141413] shadow-sm">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.1))}
              className="p-1 hover:text-[#C22915]"
              title="تصغير"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono-num text-xs min-w-[36px] text-center font-bold">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.1))}
              className="p-1 hover:text-[#C22915]"
              title="تكبير"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="px-1.5 py-0.5 bg-[#ECE9E1] border border-[#D4D1C7] text-[10px] font-mono-num"
            >
              100%
            </button>
            <div className="w-px h-3.5 bg-[#D4D1C7] mx-1"></div>
            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-[#4F4D46]">
              <input
                type="checkbox"
                checked={showGuides}
                onChange={(e) => setShowGuides(e.target.checked)}
                className="accent-[#141413]"
              />
              <span>إرشادات القص والنزيف</span>
            </label>
          </div>

          {/* Technical Specs Overlay Card */}
          <div className="absolute bottom-3 left-3 z-20 hidden md:block bg-[#FBFBF9]/95 border border-[#D4D1C7] p-2.5 text-[11px] font-mono-num text-[#4F4D46] shadow-sm space-y-1">
            <div className="flex justify-between gap-3">
              <span className="text-[#827F75]">مقاس القص (Trim):</span>
              <span className="font-bold text-[#141413]">{trimWidthMm} × {trimHeightMm} مم</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#827F75]">شامل النزيف (Bleed):</span>
              <span className="text-[#C22915] font-bold">+{bleedMm}مم ({totalWidthMm} × {totalHeightMm} مم)</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#827F75]">فتحات القص بالليزر:</span>
              <span className="text-[#15803D] font-bold">{template.cutouts.length} فتحة معتمدة</span>
            </div>
          </div>

          {/* Drag & Drop Visual Hint Banner */}
          {isDragOverCanvas && (
            <div className="absolute inset-0 z-40 bg-[#F4F2ED]/90 backdrop-blur-sm border-4 border-dashed border-[#C22915] flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-100">
              <Upload className="w-12 h-12 text-[#C22915] mb-2 animate-bounce" />
              <h3 className="text-lg font-bold text-[#141413]">أفلت الصورة هنا لوضعها على الجراب فوراً</h3>
              <p className="text-xs text-[#5A5850]">ستتم معالجة الصورة محلياً وحساب دقة الـ 300 DPI فوراً</p>
            </div>
          )}

          {/* Canvas Wrapper with Precision Millimeter Rulers */}
          <div className="m-auto flex flex-col items-center justify-center py-4 px-6">
          <div
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.05s ease-out',
            }}
            className="relative shadow-md select-none mt-4"
          >
            {/* Top Millimeter Ruler */}
            {showRulers && (
              <div
                className="absolute -top-5 left-0 right-0 h-5 bg-[#ECE9E1] border-t border-x border-[#D4D1C7] flex items-end overflow-hidden text-[8px] font-mono-num text-[#4F4D46]"
                style={{ width: `${canvasWidthPx}px` }}
              >
                {Array.from({ length: Math.ceil(totalWidthMm / 10) + 1 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="absolute border-l border-[#827F75] h-3 flex items-start pl-0.5"
                    style={{ left: `${idx * 10 * scalePxPerMm}px` }}
                  >
                    <span>{idx * 10}</span>
                  </div>
                ))}
                {/* Bleed indicator marker on top ruler */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#C22915]"
                  style={{ left: `${bleedMm * scalePxPerMm}px` }}
                  title="بداية مقاس الكفر (حد القص)"
                />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-[#C22915]"
                  style={{ left: `${(bleedMm + trimWidthMm) * scalePxPerMm}px` }}
                  title="نهاية مقاس الكفر (حد القص)"
                />
              </div>
            )}

            {/* Left Millimeter Ruler */}
            {showRulers && (
              <div
                className="absolute -left-5 top-0 bottom-0 w-5 bg-[#ECE9E1] border-l border-y border-[#D4D1C7] flex flex-col items-end overflow-hidden text-[8px] font-mono-num text-[#4F4D46]"
                style={{ height: `${canvasHeightPx}px` }}
              >
                {Array.from({ length: Math.ceil(totalHeightMm / 10) + 1 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="absolute border-t border-[#827F75] w-3 flex items-start pt-0.5"
                    style={{ top: `${idx * 10 * scalePxPerMm}px` }}
                  >
                    <span>{idx * 10}</span>
                  </div>
                ))}
                {/* Bleed indicator marker on left ruler */}
                <div
                  className="absolute left-0 right-0 h-0.5 bg-[#C22915]"
                  style={{ top: `${bleedMm * scalePxPerMm}px` }}
                />
                <div
                  className="absolute left-0 right-0 h-0.5 bg-[#C22915]"
                  style={{ top: `${(bleedMm + trimHeightMm) * scalePxPerMm}px` }}
                />
              </div>
            )}

            {/* The Main HTML5 Canvas */}
            <canvas
              ref={canvasRef}
              width={canvasWidthPx}
              height={canvasHeightPx}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="cursor-crosshair block bg-white border border-[#D4D1C7]"
              style={{
                width: `${canvasWidthPx}px`,
                height: `${canvasHeightPx}px`,
              }}
            />

            {/* Visual Overlays: Bleed, Trim Line, Safe Zone, and Laser Cutouts */}
            {showGuides && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ width: `${canvasWidthPx}px`, height: `${canvasHeightPx}px` }}
              >
                {/* 1. Bleed Zone: Outer margin outside trim that gets wrapped or trimmed */}
                <div
                  className="absolute inset-0 border border-dashed border-[#C22915]"
                  style={{ backgroundColor: 'rgba(194, 41, 21, 0.03)' }}
                >
                  <span className="absolute top-1 left-1.5 text-[8px] font-mono-num text-[#C22915] bg-[#FBFBF9]/90 border border-[#C22915] px-1">
                    حد النزيف BLEED {bleedMm}مم
                  </span>
                </div>

                {/* 2. Trim Line: Exact Phone Outer Boundary */}
                <div
                  className="absolute border-2 border-[#141413]"
                  style={{
                    left: `${bleedMm * scalePxPerMm}px`,
                    top: `${bleedMm * scalePxPerMm}px`,
                    width: `${trimWidthMm * scalePxPerMm}px`,
                    height: `${trimHeightMm * scalePxPerMm}px`,
                    borderRadius: `${(template.cornerRadiusMm || 6) * scalePxPerMm}px`,
                  }}
                >
                  {/* Safe Zone (Inside trim line by safeMarginMm) */}
                  <div
                    className="absolute border border-dashed border-[#1D4ED8]"
                    style={{
                      left: `${safeMarginMm * scalePxPerMm}px`,
                      top: `${safeMarginMm * scalePxPerMm}px`,
                      right: `${safeMarginMm * scalePxPerMm}px`,
                      bottom: `${safeMarginMm * scalePxPerMm}px`,
                      borderRadius: `${Math.max(1, (template.cornerRadiusMm || 6) - safeMarginMm) * scalePxPerMm}px`,
                    }}
                  >
                    <span className="absolute bottom-1 right-1.5 text-[8px] font-mono-num text-[#1D4ED8] bg-[#FBFBF9]/90 border border-[#1D4ED8] px-1">
                      منطقة الأمان SAFE ZONE
                    </span>
                  </div>
                </div>

                {/* 3. Laser Cutouts Overlay (Camera, Fingerprint, Flash) */}
                {template.cutouts.map((cutout) => {
                  const effXMm = isMirroredPreview ? (template.widthMm - cutout.xMm - cutout.widthMm) : cutout.xMm;
                  const xPx = (effXMm + bleedMm) * scalePxPerMm;
                  const yPx = (cutout.yMm + bleedMm) * scalePxPerMm;
                  const wPx = cutout.widthMm * scalePxPerMm;
                  const hPx = cutout.heightMm * scalePxPerMm;
                  const rPx = (cutout.radiusMm || 0) * scalePxPerMm;
                  const isCircle = cutout.shape === 'circle';

                  return (
                    <div
                      key={cutout.id}
                      style={{
                        left: `${xPx}px`,
                        top: `${yPx}px`,
                        width: `${wPx}px`,
                        height: `${hPx}px`,
                        borderRadius: isCircle ? '9999px' : `${rPx}px`,
                      }}
                      className="absolute hatch-warning border border-[#C22915] flex items-center justify-center overflow-hidden"
                    >
                      <div className="bg-[#FBFBF9]/95 px-1 py-0.2 border border-[#C22915] text-[8px] font-bold text-[#C22915] flex items-center gap-1 font-mono-num">
                        <Camera className="w-2.5 h-2.5" />
                        <span>قص {cutout.type}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </div>
        </main>
      </div>

      {/* =========================================================================
          DEVICE SEARCH DRAWER (All 397 models from 2018 to 2026)
         ========================================================================= */}
      {deviceSearchOpen && (
        <div className="fixed inset-0 z-50 bg-[#141413]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FBFBF9] border border-[#D4D1C7] max-w-3xl w-full p-5 shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in duration-100">
            {/* Search Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#D4D1C7]">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-[#141413]" />
                <h3 className="font-bold text-base text-[#141413]">
                  كتالوج الهواتف والموديلات ({allModels.length} موديلاً من 2018 حتى 2026)
                </h3>
              </div>
              <button
                onClick={() => setDeviceSearchOpen(false)}
                className="text-[#5A5850] hover:text-[#141413] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="pt-3 pb-2 space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#827F75] absolute right-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="ابحث باسم الموديل أو الكود البديل (مثال: S24 Ultra, Redmi Note 13, 2312DRA50C, A55, iPhone 15)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 bg-white border border-[#D4D1C7] text-[#141413] text-xs sm:text-sm focus:outline-none focus:border-[#141413] placeholder-[#827F75]"
                />
              </div>

              {/* Brand Filter Chips */}
              <div className="flex flex-wrap gap-1 text-xs overflow-x-auto pb-1 max-h-24">
                <button
                  onClick={() => setBrandFilter('all')}
                  className={`px-2.5 py-1 font-semibold transition-colors border ${
                    brandFilter === 'all'
                      ? 'bg-[#141413] text-white border-[#141413]'
                      : 'bg-white text-[#5A5850] border-[#D4D1C7] hover:bg-[#F4F2ED]'
                  }`}
                >
                  الكل ({allModels.length})
                </button>
                {allBrands.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBrandFilter(b.id)}
                    className={`px-2 py-1 font-semibold transition-colors border ${
                      brandFilter.toLowerCase() === b.id.toLowerCase()
                        ? 'bg-[#141413] text-white border-[#141413]'
                        : 'bg-white text-[#5A5850] border-[#D4D1C7] hover:bg-[#F4F2ED]'
                    }`}
                  >
                    {b.nameAr || b.name}
                  </button>
                ))}
              </div>

              {/* Year Filters */}
              <div className="flex gap-2 text-xs">
                {['all', '2024-2026', '2021-2023', '2018-2020'].map((y) => (
                  <button
                    key={y}
                    onClick={() => setYearFilter(y)}
                    className={`px-2 py-0.5 text-[11px] font-mono-num border transition-colors ${
                      yearFilter === y
                        ? 'bg-[#141413] text-white border-[#141413] font-bold'
                        : 'bg-white text-[#5A5850] border-[#D4D1C7] hover:bg-[#F4F2ED]'
                    }`}
                  >
                    {y === 'all' ? 'جميع السنوات' : y}
                  </button>
                ))}
              </div>
            </div>

            {/* Model Cards List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#D4D1C7] pr-1">
              {filteredSearchModels.map((m) => {
                const isSelected = selectedModel?.id === m.id;
                const t = m.template;

                return (
                  <div
                    key={m.id}
                    onClick={() => handleSelectModel(m)}
                    className={`py-2.5 px-3 flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#ECE9E1] border-r-4 border-r-[#141413]'
                        : 'hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-[#141413]">{m.name}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-[#ECE9E1] text-[#5A5850] border border-[#D4D1C7] font-mono-num">
                          {m.releaseYear}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] px-2 py-0.5 bg-[#F0FDF4] text-[#15803D] border border-[#86EFAC] font-bold">
                            النشط حالياً
                          </span>
                        )}
                      </div>
                      {m.aliases && m.aliases.length > 0 && (
                        <p className="text-[10px] text-[#827F75] font-mono-num mt-0.5">
                          {m.aliases.join(' • ')}
                        </p>
                      )}
                    </div>

                    <div className="text-left font-mono-num text-xs text-[#5A5850]">
                      {t ? (
                        <>
                          <span className="text-[#141413] block font-bold">
                            {t.widthMm} × {t.heightMm} مم
                          </span>
                          <span className="text-[10px] text-[#827F75]">{t.cutouts.length} فتحات قص</span>
                        </>
                      ) : (
                        <span className="text-[#C22915]">يحتاج قالب</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CALIBRATOR MODAL (Tweak millimeters for current model)
         ========================================================================= */}
      {calibratorOpen && (
        <div className="fixed inset-0 z-50 bg-[#141413]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FBFBF9] border border-[#D4D1C7] max-w-md w-full p-5 shadow-2xl text-right animate-in fade-in duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-[#D4D1C7] mb-3">
              <div className="flex items-center gap-2">
                <Ruler className="w-5 h-5 text-[#15803D]" />
                <h3 className="font-bold text-sm text-[#141413]">
                  معايرة مقاسات الموديل ({selectedModel?.name})
                </h3>
              </div>
              <button onClick={() => setCalibratorOpen(false)} className="text-[#5A5850] hover:text-[#141413]">
                ✕
              </button>
            </div>

            <p className="text-xs text-[#5A5850] mb-4 leading-relaxed">
              إذا استلمت كفرات من المورد بمقاسات تختلف قليلاً، يمكنك تعديل الأبعاد بالملليمتر بدقة هنا وسيتم تطبيقها على الكانفاس فوراً.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="text-[11px] text-[#5A5850] mb-1 block">عرض الكفر Trim (mm):</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempWidthMm}
                  onChange={(e) => setTempWidthMm(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white border border-[#D4D1C7] text-[#141413] font-mono-num text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#5A5850] mb-1 block">ارتفاع الكفر Trim (mm):</label>
                <input
                  type="number"
                  step="0.1"
                  value={tempHeightMm}
                  onChange={(e) => setTempHeightMm(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white border border-[#D4D1C7] text-[#141413] font-mono-num text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#5A5850] mb-1 block">تقويس الأركان Radius (mm):</label>
                <input
                  type="number"
                  step="0.5"
                  value={tempRadiusMm}
                  onChange={(e) => setTempRadiusMm(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white border border-[#D4D1C7] text-[#141413] font-mono-num text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-[#5A5850] mb-1 block">هامش النزيف Bleed (mm):</label>
                <input
                  type="number"
                  step="0.5"
                  value={tempBleedMm}
                  onChange={(e) => setTempBleedMm(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-1.5 bg-white border border-[#D4D1C7] text-[#141413] font-mono-num text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-[#D4D1C7]">
              <button
                onClick={() => setCalibratorOpen(false)}
                className="px-3 py-1.5 bg-[#ECE9E1] border border-[#D4D1C7] text-[#5A5850] text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveCalibration}
                className="px-4 py-1.5 bg-[#141413] text-white font-bold text-xs border border-[#141413]"
              >
                تطبيق وتحديث القالب
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          INSTANT PRODUCTION EXPORT DOWNLOAD MODAL (1-Click for Operator)
         ========================================================================= */}
      {exportModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#141413]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#FBFBF9] border border-[#D4D1C7] max-w-lg w-full p-5 shadow-2xl text-right animate-in fade-in duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-[#D4D1C7] mb-3">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-[#141413]" />
                <h3 className="font-bold text-sm text-[#141413]">تصدير حزمة ملفات الطباعة والقص الميكانيكي</h3>
              </div>
              <button onClick={() => setExportModalOpen(false)} className="text-[#5A5850] hover:text-[#141413]">
                ✕
              </button>
            </div>

            {isExporting ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-8 h-8 border-3 border-[#141413] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-sm font-bold text-[#141413]">جاري توليد ملفات الطباعة والقص بدقة 300 DPI...</p>
                <p className="text-xs text-[#5A5850] font-mono-num">PDF/X-4 CMYK + علامات القص Crop Marks + طبقة CUT</p>
              </div>
            ) : exportError ? (
              <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] text-[#991B1B] text-xs space-y-3">
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-[#B91C1C]" />
                  <span>تنبيه ما قبل الطباعة (Preflight Warning):</span>
                </div>
                <p className="leading-relaxed">{exportError}</p>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    onClick={() => setExportModalOpen(false)}
                    className="px-3 py-1 bg-white border border-[#D4D1C7] text-xs text-[#5A5850]"
                  >
                    الرجوع لتعديل التصميم
                  </button>
                  <button
                    onClick={() => handleInstantProductionExport(true)}
                    className="px-3 py-1 bg-[#B91C1C] text-white text-xs font-bold"
                  >
                    تجاوز التنبيه والتصدير على أي حال
                  </button>
                </div>
              </div>
            ) : exportResult ? (
              <div className="space-y-4">
                <div className="p-3 bg-[#F0FDF4] border border-[#86EFAC] text-xs text-[#15803D] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                  <span>
                    تم إعداد ملفات الطباعة والقص بنجاح لموديل {selectedModel?.name} وجاهزة للماكينات فوراً!
                  </span>
                </div>

                {/* Master 1-Click Download All Button */}
                <button
                  type="button"
                  onClick={handleDownloadAllExportFiles}
                  className="w-full py-2.5 px-4 bg-[#141413] hover:bg-[#282725] text-white font-bold text-xs flex items-center justify-center gap-2 border border-[#141413] shadow-sm transition-all"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>تحميل حزمة الإنتاج كاملة (كافة الـ 4 ملفات بنقرة واحدة)</span>
                </button>

                {/* Direct Download Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {/* Clean Production PDF */}
                  <a
                    href={`/api/download?file=${encodeURIComponent(exportResult.files?.pdfUrl || '')}`}
                    download
                    className="p-3 bg-white hover:bg-[#F0FDF4] border border-[#86EFAC] flex items-center justify-between text-xs text-[#141413] transition-all group shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-5 h-5 text-[#15803D]" />
                      <div>
                        <span className="font-bold block text-[#15803D]">ملف الطباعة النهائي (نظيف للماكينة)</span>
                        <span className="text-[10px] text-[#5A5850] font-mono-num">300 DPI + مسطرة ملليمتر + علامات CCD</span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-[#15803D] group-hover:scale-110" />
                  </a>

                  {/* Proof & Die-Line Verification PDF */}
                  {exportResult.files?.proofPdfUrl && (
                    <a
                      href={`/api/download?file=${encodeURIComponent(exportResult.files.proofPdfUrl)}`}
                      download
                      className="p-3 bg-white hover:bg-[#FEF2F2] border border-[#FECACA] flex items-center justify-between text-xs text-[#141413] transition-all group shadow-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-5 h-5 text-[#DC2626]" />
                        <div>
                          <span className="font-bold block text-[#DC2626]">بروفة مطابقة خطوط القص (Proof)</span>
                          <span className="text-[10px] text-[#5A5850] font-mono-num">معاينة الداي لاين والتفريغات الرياضية</span>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-[#DC2626] group-hover:scale-110" />
                    </a>
                  )}

                  {/* Laser Cut SVG */}
                  <a
                    href={`/api/download?file=${encodeURIComponent(exportResult.files?.cutSvgUrl || '')}`}
                    download
                    className="p-3 bg-white hover:bg-[#F4F2ED] border border-[#D4D1C7] flex items-center justify-between text-xs text-[#141413] transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <FileCode className="w-5 h-5 text-[#7C3AED]" />
                      <div>
                        <span className="font-bold block">داي لاين القص (CUT Vector)</span>
                        <span className="text-[10px] text-[#5A5850] font-mono-num">SVG فكتور للكاتر والليزر 1:1</span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-[#141413] group-hover:scale-110" />
                  </a>

                  {/* High-res PNG */}
                  <a
                    href={`/api/download?file=${encodeURIComponent(exportResult.files?.pngUrl || '')}`}
                    download
                    className="p-3 bg-white hover:bg-[#F4F2ED] border border-[#D4D1C7] flex items-center justify-between text-xs text-[#141413] transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Upload className="w-5 h-5 text-[#1D4ED8]" />
                      <div>
                        <span className="font-bold block">PNG عالي الدقة 300 DPI</span>
                        <span className="text-[10px] text-[#5A5850] font-mono-num">مباشر من أصول الصور</span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-[#141413] group-hover:scale-110" />
                  </a>

                  {/* Spot White Underbase for UV (If generated) */}
                  {exportResult.files?.whiteUnderbaseUrl && (
                    <a
                      href={`/api/download?file=${encodeURIComponent(exportResult.files.whiteUnderbaseUrl)}`}
                      download
                      className="p-3 bg-white hover:bg-[#F4F2ED] border border-[#D4D1C7] flex items-center justify-between text-xs text-[#141413] transition-all group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Sparkles className="w-5 h-5 text-[#15803D]" />
                        <div>
                          <span className="font-bold block">طبقة الأبيض (White Mask)</span>
                          <span className="text-[10px] text-[#5A5850] font-mono-num">Spot White لماكينات UV</span>
                        </div>
                      </div>
                      <Download className="w-4 h-4 text-[#141413] group-hover:scale-110" />
                    </a>
                  )}

                  {/* Job Ticket */}
                  <a
                    href={`/api/download?file=${encodeURIComponent(exportResult.files?.jobTicketUrl || '')}`}
                    download
                    className="p-3 bg-white hover:bg-[#F4F2ED] border border-[#D4D1C7] flex items-center justify-between text-xs text-[#141413] transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <Smartphone className="w-5 h-5 text-[#5A5850]" />
                      <div>
                        <span className="font-bold block">بطاقة التشغيل (Job Ticket)</span>
                        <span className="text-[10px] text-[#5A5850] font-mono-num">أبعاد ومواصفات الطلب</span>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-[#141413] group-hover:scale-110" />
                  </a>
                </div>

                {/* Inspect & Open in Browser Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#D4D1C7]">
                  <div className="flex items-center gap-2">
                    <a
                      href={`/api/download?file=${encodeURIComponent(exportResult.files?.proofPdfUrl || exportResult.files?.pdfUrl || '')}&inline=1`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-[#FEF2F2] hover:bg-[#FEE2E2] border border-[#FECACA] text-xs font-bold text-[#DC2626] flex items-center gap-1.5"
                    >
                      <Eye className="w-4 h-4 text-[#DC2626]" />
                      <span>معاينة بروفة خطوط القص (زوم 100%)</span>
                    </a>

                    <a
                      href={`/api/download?file=${encodeURIComponent(exportResult.files?.pdfUrl || '')}&inline=1`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-white hover:bg-[#F0FDF4] border border-[#86EFAC] text-xs font-bold text-[#15803D] flex items-center gap-1.5"
                    >
                      <Eye className="w-4 h-4 text-[#15803D]" />
                      <span>معاينة ملف الطباعة النظيف</span>
                    </a>
                  </div>

                  <button
                    onClick={() => setExportModalOpen(false)}
                    className="px-5 py-1.5 bg-[#ECE9E1] border border-[#D4D1C7] text-xs font-semibold text-[#141413] hover:bg-[#D4D1C7]"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* =========================================================================
          3D REALISTIC PHONE CASE MOCKUP MODAL
         ========================================================================= */}
      {is3dMockupOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141413] border border-[#4F4D46] max-w-lg w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#33322E] pb-3">
              <div className="flex items-center gap-2">
                <Box className="w-5 h-5 text-[#3B82F6]" />
                <h3 className="font-bold text-sm">معاينة 3D الواقعية للهاتف ({selectedModel?.name})</h3>
              </div>
              <button onClick={() => setIs3dMockupOpen(false)} className="text-[#A8A29E] hover:text-white">✕</button>
            </div>

            <div className="flex items-center justify-center py-6 bg-gradient-to-b from-[#181816] to-[#0d0d0c] rounded-lg relative overflow-hidden border border-[#333]">
              {(() => {
                const tmpl = selectedModel?.template;
                const modelWidthMm = tmpl?.widthMm || 75;
                const modelHeightMm = tmpl?.heightMm || 160;
                const mockupWidth = 230;
                const mockupScale = mockupWidth / modelWidthMm; // px per mm
                const mockupHeight = Math.round(modelHeightMm * mockupScale);
                const cornerRadiusPx = Math.round((tmpl?.cornerRadiusMm || 7) * mockupScale);

                return (
                  <div
                    className="relative border-[4px] border-[#383734] overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.95)] transition-all bg-[#1a1a1a]"
                    style={{
                      width: `${mockupWidth}px`,
                      height: `${mockupHeight}px`,
                      borderRadius: `${cornerRadiusPx}px`,
                    }}
                  >
                    {/* Realistic 3D glass gloss & lighting reflections */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/15 via-transparent to-white/5 pointer-events-none z-10"></div>
                    <div className="absolute inset-y-0 left-0 w-2.5 bg-gradient-to-r from-white/20 to-transparent pointer-events-none z-10"></div>
                    <div className="absolute inset-y-0 right-0 w-2.5 bg-gradient-to-l from-black/40 to-transparent pointer-events-none z-10"></div>

                    {/* Artwork on the case */}
                    <img
                      src={canvasRef.current?.toDataURL('image/png')}
                      alt="3D Case Mockup"
                      className="w-full h-full object-cover"
                    />

                    {/* DYNAMIC REAL CUTOUTS (Cameras, Fingerprint, Flash) */}
                    {tmpl?.cutouts?.map((c) => {
                      const effXMm = isMirroredPreview ? (tmpl.widthMm - c.xMm - c.widthMm) : c.xMm;
                      const cLeft = Math.round(effXMm * mockupScale);
                      const cTop = Math.round(c.yMm * mockupScale);
                      const cW = Math.round(c.widthMm * mockupScale);
                      const cH = Math.round(c.heightMm * mockupScale);
                      const isCircle = c.shape === 'circle';
                      const cRadius = isCircle ? 9999 : Math.round((c.radiusMm || 6) * mockupScale);

                      if (c.type === 'camera') {
                        const lensCount = Math.max(1, Math.min(4, Math.floor(c.heightMm / 15)));
                        return (
                          <div
                            key={c.id}
                            className="absolute bg-[#121212]/95 border border-white/30 shadow-[inset_0_2px_4px_rgba(0,0,0,0.9),0_2px_8px_rgba(0,0,0,0.8)] z-20 flex flex-col items-center justify-around py-1"
                            style={{
                              left: `${cLeft}px`,
                              top: `${cTop}px`,
                              width: `${cW}px`,
                              height: `${cH}px`,
                              borderRadius: `${cRadius}px`,
                            }}
                          >
                            {/* Realistic camera lenses */}
                            {Array.from({ length: lensCount }).map((_, idx) => (
                              <div
                                key={idx}
                                className="rounded-full bg-[#0a0a0a] border border-[#555] shadow-inner relative flex items-center justify-center my-0.5"
                                style={{
                                  width: `${Math.min(cW - 6, 20)}px`,
                                  height: `${Math.min(cW - 6, 20)}px`,
                                }}
                              >
                                <div className="w-2 h-2 rounded-full bg-[#1e293b] border border-blue-400/40 relative">
                                  <div className="w-0.5 h-0.5 bg-white rounded-full absolute top-0.5 right-0.5"></div>
                                </div>
                              </div>
                            ))}
                            {/* Small Flash LED if tall */}
                            {cH > 45 && (
                              <div className="w-1.5 h-1.5 rounded-full bg-[#fef08a] border border-[#ca8a04]/60 my-0.5"></div>
                            )}
                          </div>
                        );
                      }

                      if (c.type === 'fingerprint') {
                        return (
                          <div
                            key={c.id}
                            className="absolute bg-[#1a1a1a]/90 rounded-full border border-white/30 shadow-[inset_0_3px_6px_rgba(0,0,0,0.9)] z-20 flex items-center justify-center"
                            style={{
                              left: `${cLeft}px`,
                              top: `${cTop}px`,
                              width: `${cW}px`,
                              height: `${cH}px`,
                            }}
                          >
                            <div className="w-3/4 h-3/4 rounded-full border border-[#444] bg-[#222]"></div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={c.id}
                          className="absolute bg-black/85 border border-white/20 shadow-inner z-20"
                          style={{
                            left: `${cLeft}px`,
                            top: `${cTop}px`,
                            width: `${cW}px`,
                            height: `${cH}px`,
                            borderRadius: `${cRadius}px`,
                          }}
                        />
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-xs text-[#A8A29E]">إضاءة واقعية مع انعكاس السطح والبروز</span>
              <button
                onClick={downloadCanvasAsPng}
                className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-bold text-xs flex items-center gap-1.5 rounded transition-all"
              >
                <Download className="w-4 h-4" />
                <span>تحميل صورة الـ Mockup</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CUSTOMER APPROVAL PROOF SHEET MODAL (With Watermark for WhatsApp)
         ========================================================================= */}
      {proofModalOpen && proofDataUrl && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D4D1C7] max-w-xl w-full p-5 space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D4D1C7] pb-2.5">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-[#15803D]" />
                <h3 className="font-bold text-sm text-[#141413]">بروفة اعتماد العميل المائية (WhatsApp Proof)</h3>
              </div>
              <button onClick={() => setProofModalOpen(false)} className="text-[#5A5850] hover:text-[#141413]">✕</button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto border border-[#D4D1C7] bg-[#F4F2ED] p-2 flex justify-center">
              <img src={proofDataUrl} alt="Customer Proof" className="max-h-[480px] w-auto shadow-md" />
            </div>

            <div className="flex justify-between items-center pt-1 text-xs">
              <span className="text-[#5A5850]">مجهزة بعلامة مائية رسمية وشروط الاعتماد</span>
              <a
                href={proofDataUrl}
                download={`PROOF_${selectedModel?.name?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'CASE'}.jpg`}
                className="px-4 py-2 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Download className="w-4 h-4" />
                <span>تحميل البروفة لإرسالها للعميل</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          GANG SHEET OPTIMIZER MODAL (A3 / A4 Batch Production)
         ========================================================================= */}
      {gangSheetModalOpen && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#D4D1C7] max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#D4D1C7] pb-2.5">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#A16207]" />
                <h3 className="font-bold text-sm text-[#141413]">فرخ التجميع Gang Sheet (توفير 60% من الورق والحبر)</h3>
              </div>
              <button onClick={() => setGangSheetModalOpen(false)} className="text-[#5A5850] hover:text-[#141413]">✕</button>
            </div>

            <div className="p-3 bg-[#FEFCE8] border border-[#FDE047] text-xs text-[#854D0E] space-y-1">
              <span className="font-bold block">ميزة التوفير القصوى للورش والمطابع:</span>
              <span>يرص الموقع من 6 إلى 8 طلبات على فرخ A3 واحد بدقة 300 DPI مع مسافات الأمان وأرقام الطلبات تلقائياً!</span>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <span className="font-bold text-[#141413]">مقاس الفرخ:</span>
              <button
                onClick={() => setGangSheetSize('A3')}
                className={`px-3 py-1.5 border font-bold ${
                  gangSheetSize === 'A3' ? 'bg-[#141413] text-white border-[#141413]' : 'bg-white text-[#141413] border-[#D4D1C7]'
                }`}
              >
                A3 (329 × 483 مم - حتى 8 كفرات)
              </button>
              <button
                onClick={() => setGangSheetSize('A4')}
                className={`px-3 py-1.5 border font-bold ${
                  gangSheetSize === 'A4' ? 'bg-[#141413] text-white border-[#141413]' : 'bg-white text-[#141413] border-[#D4D1C7]'
                }`}
              >
                A4 (210 × 297 مم - حتى 4 كفرات)
              </button>
            </div>

            {gangSheetResult ? (
              <div className="p-4 bg-[#F0FDF4] border border-[#86EFAC] text-xs text-[#15803D] space-y-3">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-[#15803D]" />
                  <span>تم تجميع الفرخ بنجاح! تم رص {gangSheetResult.itemsPlaced} كفرات على فرخ {gangSheetResult.sheetSize}.</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <a
                    href={gangSheetResult.downloadPdfUrl}
                    download
                    className="flex-1 py-2 bg-[#141413] text-white text-center font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل PDF الفرخ للماكينة</span>
                  </a>
                  <a
                    href={gangSheetResult.downloadPngUrl}
                    download
                    className="flex-1 py-2 bg-white text-[#141413] border border-[#D4D1C7] text-center font-bold text-xs flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تحميل PNG بدقة 300 DPI</span>
                  </a>
                </div>
              </div>
            ) : (
              <button
                disabled={isGeneratingGangSheet}
                onClick={() => handleGenerateGangSheet(gangSheetSize)}
                className="w-full py-2.5 bg-[#141413] hover:bg-[#282725] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isGeneratingGangSheet ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <FileSpreadsheet className="w-4 h-4 text-[#FDE047]" />
                )}
                <span>توليد وتجميع الفرخ الآن (Generate Gang Sheet)</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
