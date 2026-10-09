'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Upload,
  Type,
  Shapes,
  Layers,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  AlertTriangle,
  CheckCircle2,
  Printer,
  ChevronRight,
  Info,
  Download,
  Sliders,
  Palette,
  Sparkles,
  ShieldAlert,
  ArrowUp,
  ArrowDown,
  Camera,
  Crop,
} from 'lucide-react';
import {
  DeviceModel,
  CanvasElement,
  ImageElement,
  TextElement,
  ShapeElement,
  DesignData,
  PreflightReport,
} from '@/types';
import { runPreflightCheck } from '@/lib/preflight';

interface DesignEditorProps {
  model: DeviceModel;
}

export default function DesignEditor({ model }: DesignEditorProps) {
  const router = useRouter();
  const template = model.template!;

  // Millimeters specs
  const bleedMm = template.bleedMm || 3.0;
  const safeMarginMm = template.safeMarginMm || 3.0;
  const trimWidthMm = template.widthMm;
  const trimHeightMm = template.heightMm;
  const totalWidthMm = trimWidthMm + bleedMm * 2;
  const totalHeightMm = trimHeightMm + bleedMm * 2;

  // Visual Scale: px per mm
  const [scalePxPerMm, setScalePxPerMm] = useState<number>(4.2);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Canvas dimensions in pixels
  const canvasWidthPx = Math.round(totalWidthMm * scalePxPerMm);
  const canvasHeightPx = Math.round(totalHeightMm * scalePxPerMm);

  // Elements state
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [backgroundColor, setBackgroundColor] = useState<string>('#ffffff');

  // History for Undo / Redo
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // UI Panels
  const [activeTab, setActiveTab] = useState<'upload' | 'text' | 'shapes' | 'filters' | 'layers'>('upload');
  const [showGuides, setShowGuides] = useState<boolean>(true);
  const [showBleedOverlay, setShowBleedOverlay] = useState<boolean>(true);
  const [showCutoutHatching, setShowCutoutHatching] = useState<boolean>(true);

  // Text inputs
  const [newText, setNewText] = useState<string>('نص احترافي');
  const [fontFamily, setFontFamily] = useState<string>('Cairo');
  const [textColor, setTextColor] = useState<string>('#1e293b');
  const [fontSize, setFontSize] = useState<number>(28);

  // Preflight & Order Modals
  const [preflightModalOpen, setPreflightModalOpen] = useState<boolean>(false);
  const [orderModalOpen, setOrderModalOpen] = useState<boolean>(false);
  const [currentPreflight, setCurrentPreflight] = useState<PreflightReport | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // Customer checkout inputs
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerCity, setCustomerCity] = useState<string>('القاهرة');
  const [customerNotes, setCustomerNotes] = useState<string>('');

  // Canvas Refs
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const elementStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Loaded HTML Images cache
  const loadedImagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  // Save state to history
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
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setElements(JSON.parse(JSON.stringify(next)));
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Pre-load image helper
  const preloadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      if (loadedImagesRef.current.has(src)) {
        resolve(loadedImagesRef.current.get(src)!);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        loadedImagesRef.current.set(src, img);
        resolve(img);
      };
      img.src = src;
    });
  };

  // Calculate live DPI for an image element
  const calculateDpi = (el: ImageElement): number => {
    const renderedWidthMm = (el.originalWidth * el.scaleX) / scalePxPerMm;
    if (renderedWidthMm <= 0) return 300;
    const dpi = Math.round(el.originalWidth / (renderedWidthMm / 25.4));
    return dpi;
  };

  // Add Image to Canvas
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        await preloadImage(data.url);

        // Calculate initial scale to fit nicely in canvas
        const targetWidthPx = canvasWidthPx * 0.9;
        const scale = targetWidthPx / data.originalWidth;

        const newEl: ImageElement = {
          id: `img-${Date.now()}`,
          type: 'image',
          src: data.url,
          originalWidth: data.originalWidth,
          originalHeight: data.originalHeight,
          x: (canvasWidthPx - data.originalWidth * scale) / 2,
          y: (canvasHeightPx - data.originalHeight * scale) / 2,
          scaleX: scale,
          scaleY: scale,
          rotation: 0,
          opacity: 1,
          zIndex: elements.length + 1,
          currentDpi: Math.round(data.originalWidth / (((data.originalWidth * scale) / scalePxPerMm) / 25.4)),
          filters: {},
        };

        const updated = [...elements, newEl];
        setElements(updated);
        setSelectedId(newEl.id);
        pushHistory(updated);
      }
    } catch (err) {
      console.error('Upload error:', err);
    }
  };

  // Add Text Element
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
      x: canvasWidthPx / 2 - 60,
      y: canvasHeightPx / 2,
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
  };

  // Add Shape Element
  const handleAddShape = (shapeType: 'rect' | 'circle' | 'heart' | 'star') => {
    const newEl: ShapeElement = {
      id: `shape-${Date.now()}`,
      type: 'shape',
      shapeType,
      width: 70,
      height: 70,
      fill: '#0284c7',
      x: canvasWidthPx / 2 - 35,
      y: canvasHeightPx / 2 - 35,
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
  };

  // Render elements to HTML5 Canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasWidthPx, canvasHeightPx);

    // Draw Background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);

    // Sort elements by zIndex
    const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);

    for (const el of sorted) {
      if (el.opacity <= 0) continue;

      ctx.save();
      ctx.globalAlpha = el.opacity;

      // Translate and rotate
      ctx.translate(el.x, el.y);
      if (el.rotation) {
        ctx.rotate((el.rotation * Math.PI) / 180);
      }
      ctx.scale(el.scaleX, el.scaleY);

      if (el.type === 'image') {
        const img = loadedImagesRef.current.get(el.src);
        if (img) {
          // Apply filters if any
          if (el.filters?.grayscale) {
            ctx.filter = 'grayscale(100%)';
          } else if (el.filters?.sepia) {
            ctx.filter = 'sepia(100%)';
          }
          ctx.drawImage(img, 0, 0, el.originalWidth, el.originalHeight);
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
          // Simple heart path
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

      // Draw selection bounding outline
      if (el.id === selectedId) {
        ctx.lineWidth = 2 / el.scaleX;
        ctx.strokeStyle = '#0284c7';
        ctx.setLineDash([6 / el.scaleX, 4 / el.scaleX]);
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
        ctx.strokeRect(-2, -2, boundW + 4, boundH + 4);
      }

      ctx.restore();
    }
  }, [elements, selectedId, backgroundColor, canvasWidthPx, canvasHeightPx]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  // Selected element helper
  const selectedElement = elements.find((e) => e.id === selectedId);

  // Update selected element property
  const updateSelected = (updater: (prev: CanvasElement) => CanvasElement) => {
    if (!selectedId) return;
    const updated = elements.map((el) => (el.id === selectedId ? updater(el) : el));
    setElements(updated);
  };

  // Pointer drag handling on canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / zoomLevel;
    const clickY = (e.clientY - rect.top) / zoomLevel;

    // Find clicked element from top z-index downwards
    const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex);
    let hit: CanvasElement | null = null;

    for (const el of sorted) {
      if (el.locked) continue;
      let w = 100;
      let h = 100;
      if (el.type === 'image') {
        w = el.originalWidth * el.scaleX;
        h = el.originalHeight * el.scaleY;
      } else if (el.type === 'text') {
        w = el.text.length * (el.fontSize * 0.6) * el.scaleX;
        h = el.fontSize * 1.2 * el.scaleY;
      } else if (el.type === 'shape') {
        w = el.width * el.scaleX;
        h = el.height * el.scaleY;
      }

      if (clickX >= el.x && clickX <= el.x + w && clickY >= el.y && clickY <= el.y + h) {
        hit = el;
        break;
      }
    }

    if (hit) {
      setSelectedId(hit.id);
      isDraggingRef.current = true;
      dragStartRef.current = { x: clickX, y: clickY };
      elementStartRef.current = { x: hit.x, y: hit.y };
    } else {
      setSelectedId(null);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || !selectedId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const currentX = (e.clientX - rect.left) / zoomLevel;
    const currentY = (e.clientY - rect.top) / zoomLevel;

    const dx = currentX - dragStartRef.current.x;
    const dy = currentY - dragStartRef.current.y;

    setElements((prev) =>
      prev.map((el) => {
        if (el.id === selectedId) {
          return {
            ...el,
            x: Math.round(elementStartRef.current.x + dx),
            y: Math.round(elementStartRef.current.y + dy),
          };
        }
        return el;
      })
    );
  };

  const handleMouseUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      pushHistory(elements);
    }
  };

  // Trigger Preflight Check before order
  const handlePreflightCheck = () => {
    const designData: DesignData = {
      canvasWidthPx,
      canvasHeightPx,
      pxPerMm: scalePxPerMm,
      elements,
      backgroundColor,
    };

    const report = runPreflightCheck(designData, model);
    setCurrentPreflight(report);
    setPreflightModalOpen(true);
  };

  // Submit Order and Generate Print Files
  const handleProceedToCheckout = async () => {
    if (!customerName || !customerPhone) {
      setOrderError('يرجى كتابة الاسم ورقم الهاتف لإتمام الطلب');
      return;
    }

    setIsSubmitting(true);
    setOrderError(null);

    try {
      // Export high-res canvas image data URL
      const canvas = canvasRef.current;
      const previewDataUrl = canvas ? canvas.toDataURL('image/png') : undefined;

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
          customerName,
          customerPhone,
          customerCity,
          customerNotes,
          modelId: model.id,
          designData,
          previewDataUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setOrderError(data.errorAr || data.error || 'حدث خطأ أثناء معالجة ملفات الطباعة');
        setIsSubmitting(false);
        return;
      }

      // Order created! Redirect to order view
      router.push(`/orders/${data.order.id}`);
    } catch (err: any) {
      setOrderError(err.message || 'فشل الاتصال بالخادم');
      setIsSubmitting(false);
    }
  };

  // Selected image DPI calculation
  const selectedImageDpi =
    selectedElement && selectedElement.type === 'image'
      ? calculateDpi(selectedElement as ImageElement)
      : null;

  return (
    <div className="flex-1 flex flex-col bg-slate-900 text-slate-100 min-h-[calc(100vh-64px)]">
      {/* Top Editor Bar */}
      <div className="bg-slate-950 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <ChevronRight className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base text-white">{model.name}</span>
              <span className="text-xs bg-sky-900/50 text-sky-300 px-2 py-0.5 rounded border border-sky-700/50">
                {trimWidthMm} × {trimHeightMm} مم
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              + {bleedMm}مم هامش Bleed • {template.cutouts.length} فتحات مقصوصة
            </p>
          </div>
        </div>

        {/* Live DPI Status Indicator */}
        <div className="flex items-center gap-2">
          {selectedImageDpi !== null ? (
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                selectedImageDpi >= 300
                  ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700'
                  : selectedImageDpi >= 200
                  ? 'bg-amber-950/80 text-amber-400 border-amber-700'
                  : 'bg-red-950/90 text-red-400 border-red-700 animate-pulse'
              }`}
            >
              <Info className="w-3.5 h-3.5" />
              <span>دقة الصورة: {selectedImageDpi} DPI</span>
              {selectedImageDpi < 300 && <span className="hidden md:inline">(أقل من 300)</span>}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
              <span>جاهز للطباعة 300 DPI</span>
            </div>
          )}

          {/* Undo / Redo */}
          <div className="flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700">
            <button
              onClick={undo}
              disabled={historyIndex <= 0}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
              title="تراجع (Undo)"
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button
              onClick={redo}
              disabled={historyIndex >= history.length - 1}
              className="p-1 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
              title="إعادة (Redo)"
            >
              <Redo2 className="w-4 h-4" />
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={handlePreflightCheck}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-sky-600/25 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>فحص وتصدير الطباعة</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: Left Toolbar + Center Canvas + Right Inspector */}
      <div className="flex-1 flex flex-col md:flex-row relative overflow-hidden">
        {/* Left Tools Panel */}
        <aside className="w-full md:w-80 bg-slate-950/80 border-b md:border-b-0 md:border-l border-slate-800 flex flex-col z-10 shrink-0">
          {/* Tool Navigation Tabs */}
          <div className="grid grid-cols-5 p-2 bg-slate-900 border-b border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('upload')}
              className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'upload' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>الصور</span>
            </button>
            <button
              onClick={() => setActiveTab('text')}
              className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'text' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Type className="w-4 h-4" />
              <span>نصوص</span>
            </button>
            <button
              onClick={() => setActiveTab('shapes')}
              className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'shapes' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Shapes className="w-4 h-4" />
              <span>أشكال</span>
            </button>
            <button
              onClick={() => setActiveTab('filters')}
              className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'filters' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>تعديلات</span>
            </button>
            <button
              onClick={() => setActiveTab('layers')}
              className={`py-2 px-1 rounded-lg flex flex-col items-center gap-1 transition-colors ${
                activeTab === 'layers' ? 'bg-sky-600 text-white font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>الطبقات</span>
            </button>
          </div>

          {/* Tool Content Panels */}
          <div className="p-4 overflow-y-auto max-h-[280px] md:max-h-none flex-1 space-y-4">
            {/* 1. Upload Images */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-bold text-sm text-slate-200 mb-1">رفع صورة للتصميم</h4>
                  <p className="text-xs text-slate-400 mb-3">
                    يدعم JPG وPNG. يُفضل دقة عالية للحصول على 300 DPI حقيقي.
                  </p>

                  <label className="border-2 border-dashed border-sky-600/50 hover:border-sky-400 bg-sky-950/20 hover:bg-sky-950/40 rounded-2xl p-6 text-center cursor-pointer flex flex-col items-center gap-3 transition-all block">
                    <div className="w-12 h-12 rounded-full bg-sky-600/20 text-sky-400 flex items-center justify-center">
                      <Upload className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="font-bold text-sm text-sky-300 block">اختر صورة من جهازك</span>
                      <span className="text-xs text-slate-400">JPG أو PNG حتى 25 ميجابايت</span>
                    </div>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/jpg"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                {/* Case Background Color */}
                <div className="pt-2 border-t border-slate-800">
                  <label className="text-xs font-semibold text-slate-300 mb-2 block">لون خلفية الجراب:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={backgroundColor}
                      onChange={(e) => setBackgroundColor(e.target.value)}
                      className="w-10 h-10 rounded-lg bg-transparent cursor-pointer border border-slate-700"
                    />
                    <div className="flex gap-1.5">
                      {['#ffffff', '#000000', '#0284c7', '#ec008c', '#10b981', '#f59e0b'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setBackgroundColor(c)}
                          style={{ backgroundColor: c }}
                          className="w-7 h-7 rounded-full border border-slate-600 hover:scale-110 transition-transform"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Text Tool */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-slate-200">إضافة نصوص وعبارات</h4>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">النص:</label>
                  <input
                    type="text"
                    value={newText}
                    onChange={(e) => setNewText(e.target.value)}
                    placeholder="اكتب اسمك أو عبارتك..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">نوع الخط:</label>
                    <select
                      value={fontFamily}
                      onChange={(e) => setFontFamily(e.target.value)}
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                      <option value="Cairo">خط كايرو (Cairo)</option>
                      <option value="Tajawal">خط تجوال (Tajawal)</option>
                      <option value="Amiri">خط أميري كلاسيكي (Amiri)</option>
                      <option value="Inter">Inter (إنجليزي)</option>
                      <option value="Arial">Arial</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">الحجم:</label>
                    <input
                      type="number"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      min="12"
                      max="120"
                      className="w-full px-2.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-400 mb-1 block">لون النص:</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="w-9 h-9 rounded-lg bg-transparent cursor-pointer border border-slate-700"
                    />
                    <div className="flex gap-1.5">
                      {['#ffffff', '#000000', '#f59e0b', '#ec008c', '#0284c7'].map((c) => (
                        <button
                          key={c}
                          onClick={() => setTextColor(c)}
                          style={{ backgroundColor: c }}
                          className="w-6 h-6 rounded-full border border-slate-600"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAddText}
                  className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow"
                >
                  <Type className="w-4 h-4" />
                  <span>إضافة النص للتصميم</span>
                </button>
              </div>
            )}

            {/* 3. Shapes Tool */}
            {activeTab === 'shapes' && (
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-slate-200">إضافة أشكال هندسية</h4>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleAddShape('rect')}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500 flex flex-col items-center gap-2 text-xs text-slate-300"
                  >
                    <div className="w-8 h-8 rounded bg-sky-600"></div>
                    <span>مستطيل</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('circle')}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500 flex flex-col items-center gap-2 text-xs text-slate-300"
                  >
                    <div className="w-8 h-8 rounded-full bg-sky-600"></div>
                    <span>دائرة</span>
                  </button>
                  <button
                    onClick={() => handleAddShape('heart')}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 hover:border-sky-500 flex flex-col items-center gap-2 text-xs text-slate-300"
                  >
                    <Sparkles className="w-7 h-7 text-pink-500" />
                    <span>قلب</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. Filters & Image Controls */}
            {activeTab === 'filters' && (
              <div className="space-y-4">
                <h4 className="font-bold text-sm text-slate-200">تعديلات العنصر المحدد</h4>
                {selectedElement ? (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400">
                      العنصر: <span className="font-mono text-sky-400">{selectedElement.id}</span>
                    </p>

                    {/* Scale Slider */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>الحجم (Scale):</span>
                        <span>{selectedElement.scaleX.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.05"
                        value={selectedElement.scaleX}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          updateSelected((el) => ({ ...el, scaleX: val, scaleY: val }));
                        }}
                        className="w-full accent-sky-500"
                      />
                    </div>

                    {/* Rotation Slider */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>التدوير:</span>
                        <span>{selectedElement.rotation}°</span>
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
                        className="w-full accent-sky-500"
                      />
                    </div>

                    {/* Opacity Slider */}
                    <div>
                      <div className="flex justify-between text-xs text-slate-400 mb-1">
                        <span>الشفافية:</span>
                        <span>{Math.round(selectedElement.opacity * 100)}%</span>
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
                        className="w-full accent-sky-500"
                      />
                    </div>

                    {/* Image Filters */}
                    {selectedElement.type === 'image' && (
                      <div className="pt-2 border-t border-slate-800 space-y-2">
                        <span className="text-xs font-semibold text-slate-300 block">فلاتر الألوان:</span>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <button
                            onClick={() => {
                              updateSelected((el: any) => ({
                                ...el,
                                filters: { ...el.filters, grayscale: !el.filters?.grayscale, sepia: false },
                              }));
                            }}
                            className={`p-2 rounded-lg border ${
                              (selectedElement as ImageElement).filters?.grayscale
                                ? 'bg-sky-600 text-white border-sky-500'
                                : 'bg-slate-900 border-slate-700 text-slate-300'
                            }`}
                          >
                            أبيض وأسود
                          </button>
                          <button
                            onClick={() => {
                              updateSelected((el: any) => ({
                                ...el,
                                filters: { ...el.filters, sepia: !el.filters?.sepia, grayscale: false },
                              }));
                            }}
                            className={`p-2 rounded-lg border ${
                              (selectedElement as ImageElement).filters?.sepia
                                ? 'bg-amber-600 text-white border-amber-500'
                                : 'bg-slate-900 border-slate-700 text-slate-300'
                            }`}
                          >
                            سيبيا (داكن)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-6">
                    اضغط على أي عنصر في مساحة العمل لتعديل حجمه وتدويره وفلاتره.
                  </p>
                )}
              </div>
            )}

            {/* 5. Layers Management */}
            {activeTab === 'layers' && (
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-slate-200">الطبقات ({elements.length})</h4>
                {elements.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">لا توجد عناصر مضافة بعد.</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...elements]
                      .sort((a, b) => b.zIndex - a.zIndex)
                      .map((el) => (
                        <div
                          key={el.id}
                          onClick={() => setSelectedId(el.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            selectedId === el.id
                              ? 'bg-sky-950/60 border-sky-500 text-white'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs truncate">
                            {el.type === 'image' && <Upload className="w-3.5 h-3.5 text-sky-400 shrink-0" />}
                            {el.type === 'text' && <Type className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                            {el.type === 'shape' && <Shapes className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                            <span className="truncate">
                              {el.type === 'text' ? (el as TextElement).text : el.type}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            {/* Layer Reorder */}
                            <button
                              onClick={() => {
                                setElements((prev) =>
                                  prev.map((item) =>
                                    item.id === el.id ? { ...item, zIndex: item.zIndex + 1 } : item
                                  )
                                );
                              }}
                              className="p-1 hover:text-white"
                              title="رفع للأعلى"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setElements((prev) =>
                                  prev.map((item) =>
                                    item.id === el.id ? { ...item, zIndex: Math.max(0, item.zIndex - 1) } : item
                                  )
                                );
                              }}
                              className="p-1 hover:text-white"
                              title="إنزال للأسفل"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            {/* Lock */}
                            <button
                              onClick={() => {
                                setElements((prev) =>
                                  prev.map((item) =>
                                    item.id === el.id ? { ...item, locked: !item.locked } : item
                                  )
                                );
                              }}
                              className="p-1 hover:text-white"
                            >
                              {el.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                            </button>
                            {/* Delete */}
                            <button
                              onClick={() => {
                                setElements((prev) => prev.filter((item) => item.id !== el.id));
                                if (selectedId === el.id) setSelectedId(null);
                              }}
                              className="p-1 text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

        {/* Center Canvas Viewport */}
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 p-4 sm:p-8 overflow-auto relative">
          {/* Canvas Viewport Controls Overlay */}
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300 shadow-xl">
            <button
              onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.1))}
              className="p-1 hover:text-white"
              title="تصغير"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="font-mono">{Math.round(zoomLevel * 100)}%</span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.1))}
              className="p-1 hover:text-white"
              title="تكبير"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoomLevel(1)}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700"
            >
              100%
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1"></div>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showGuides}
                onChange={(e) => setShowGuides(e.target.checked)}
                className="rounded accent-sky-500"
              />
              <span>إرشادات القص</span>
            </label>
          </div>

          {/* Canvas Container with Physical Aspect Ratio */}
          <div
            ref={canvasContainerRef}
            style={{
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center center',
              transition: 'transform 0.1s ease-out',
            }}
            className="relative shadow-2xl rounded-2xl select-none"
          >
            {/* 1. Underlying Main Drawing Canvas */}
            <canvas
              ref={canvasRef}
              width={canvasWidthPx}
              height={canvasHeightPx}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              className="cursor-crosshair block rounded-2xl"
              style={{
                width: `${canvasWidthPx}px`,
                height: `${canvasHeightPx}px`,
              }}
            />

            {/* 2. Visual Overlay for Bleed, Safe Zone, Trim Line, and Camera Cutouts */}
            {showGuides && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{ width: `${canvasWidthPx}px`, height: `${canvasHeightPx}px` }}
              >
                {/* Bleed Margin Overlay (outer 3mm that will wrap/trim) */}
                <div
                  className="absolute inset-0 border-2 border-dashed border-red-500/60 rounded-2xl"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  }}
                >
                  <span className="absolute top-1 left-2 text-[10px] font-mono text-red-400/80">
                    Bleed {bleedMm}mm
                  </span>
                </div>

                {/* Trim Line: Actual Phone Case Edge */}
                <div
                  className="absolute border-2 border-slate-900/80 shadow-inner"
                  style={{
                    left: `${bleedMm * scalePxPerMm}px`,
                    top: `${bleedMm * scalePxPerMm}px`,
                    width: `${trimWidthMm * scalePxPerMm}px`,
                    height: `${trimHeightMm * scalePxPerMm}px`,
                    borderRadius: `${(template.cornerRadiusMm || 6) * scalePxPerMm}px`,
                  }}
                >
                  {/* Safe Zone (3mm inside trim line) */}
                  <div
                    className="absolute border border-dashed border-emerald-500/70"
                    style={{
                      left: `${safeMarginMm * scalePxPerMm}px`,
                      top: `${safeMarginMm * scalePxPerMm}px`,
                      right: `${safeMarginMm * scalePxPerMm}px`,
                      bottom: `${safeMarginMm * scalePxPerMm}px`,
                      borderRadius: `${Math.max(2, (template.cornerRadiusMm || 6) - safeMarginMm) * scalePxPerMm}px`,
                    }}
                  >
                    <span className="absolute bottom-1 right-2 text-[9px] font-mono text-emerald-400/80">
                      Safe Zone
                    </span>
                  </div>
                </div>

                {/* Cutouts Overlay (Cameras, Flash, Fingerprint) with Hazard Striping */}
                {template.cutouts.map((cutout) => {
                  const xPx = (cutout.xMm + bleedMm) * scalePxPerMm;
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
                      className="absolute hatch-warning border-2 border-red-600 shadow-md flex items-center justify-center overflow-hidden"
                    >
                      <div className="bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded text-[9px] font-bold text-red-300 flex items-center gap-1 border border-red-500/50">
                        <Camera className="w-2.5 h-2.5" />
                        <span className="hidden sm:inline">{cutout.type}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preflight Modal */}
      {preflightModalOpen && currentPreflight && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 shadow-2xl text-right animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    currentPreflight.passed ? 'bg-emerald-600/20 text-emerald-400' : 'bg-amber-600/20 text-amber-400'
                  }`}
                >
                  {currentPreflight.passed ? <CheckCircle2 className="w-6 h-6" /> : <ShieldAlert className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">
                    {currentPreflight.passed ? 'التصميم معتمد ومطابق للمواصفات' : 'تنبيهات ما قبل الطباعة (Preflight)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    فحص دقة 300 DPI، ومناطق الكاميرا، وهوامش القص
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreflightModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Checklist items */}
            <div className="space-y-3 mb-6 max-h-60 overflow-y-auto">
              {/* DPI Item */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between ${
                  currentPreflight.dpiCheck.status === 'ok'
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                    : currentPreflight.dpiCheck.status === 'warning'
                    ? 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                    : 'bg-red-950/40 border-red-800/80 text-red-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold">فحص دقة الصور (DPI):</span>
                </div>
                <span className="text-xs font-mono font-bold">
                  {currentPreflight.dpiCheck.minDpiFound} DPI (الهدف: 300)
                </span>
              </div>

              {/* Bleed Item */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between ${
                  currentPreflight.bleedCheck.status === 'ok'
                    ? 'bg-emerald-950/40 border-emerald-800/80 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-800/80 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold">تغطية الـ Bleed (الهامش 3 مم):</span>
                </div>
                <span className="text-xs font-semibold">
                  {currentPreflight.bleedCheck.hasBleed ? 'مغطى بالكامل' : 'يحتاج تمديد الحواف'}
                </span>
              </div>

              {/* Issues list */}
              {currentPreflight.issues.map((issue, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl border text-xs leading-relaxed ${
                    issue.severity === 'error'
                      ? 'bg-red-950/40 border-red-800/80 text-red-200'
                      : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                  }`}
                >
                  <p className="font-bold mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{issue.titleAr}</span>
                  </p>
                  <p className="opacity-90">{issue.descriptionAr}</p>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setPreflightModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                العودة للتعديل
              </button>
              <button
                onClick={() => {
                  setPreflightModalOpen(false);
                  setOrderModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg"
              >
                {currentPreflight.canExport ? 'متابعة إلى تأكيد الطلب' : 'تأكيد المتابعة وتجاوز التنبيهات'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout / Order Confirmation Modal */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl text-right animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-lg text-white">إتمام طلب الطباعة</h3>
                <p className="text-xs text-slate-400">
                  الموديل: {model.name} ({trimWidthMm} × {trimHeightMm} مم)
                </p>
              </div>
              <button
                onClick={() => setOrderModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg p-1"
              >
                ✕
              </button>
            </div>

            {orderError && (
              <div className="p-3 mb-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs">
                {orderError}
              </div>
            )}

            <div className="space-y-3.5 mb-6">
              <div>
                <label className="text-xs text-slate-300 font-semibold mb-1 block">اسم العميل:</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="الاسم بالكامل..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold mb-1 block">رقم الهاتف:</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold mb-1 block">المدينة / المحافظة:</label>
                <input
                  type="text"
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  placeholder="القاهرة، الجيزة، الإسكندرية..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-semibold mb-1 block">ملاحظات الطباعة:</label>
                <textarea
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  placeholder="نوع الخامة (سيليكون شفاف، هارد مطفي، إلخ)..."
                  rows={2}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                onClick={() => setOrderModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                onClick={handleProceedToCheckout}
                disabled={isSubmitting}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>جاري توليد ملفات الطباعة بدقة 300 DPI...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4" />
                    <span>تأكيد الطلب وتوليد PDF الطباعة</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
