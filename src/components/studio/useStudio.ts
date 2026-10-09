'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CaseType, Design, DesignElement, DeviceModel, ImageAdjust, ImageElement, ShapeKind } from '@/types';
import { ImageStore } from '@/lib/design/images';
import { NEUTRAL_ADJUST, newImage, newShape, newText, uid } from '@/lib/design/elements';
import { clearDraft, loadDraft, saveDraft } from '@/lib/draft';
import { getPref, setPref } from '@/lib/catalog';

export const EMPTY_DESIGN: Design = { elements: [], background: { type: 'solid', color: '#FFFFFF' } };
const MAX_HISTORY = 80;
const MAX_FILE_MB = 60;

export type Toast = { id: number; text: string; tone?: 'ok' | 'warn' | 'bad' };

export function useStudio() {
  const [model, setModelState] = useState<DeviceModel | null>(null);
  const [caseType, setCaseTypeState] = useState<CaseType>('flat');
  const [design, setDesign] = useState<Design>(EMPTY_DESIGN);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [, setHistoryTick] = useState(0);

  const designRef = useRef(design);
  designRef.current = design;
  const modelRef = useRef(model);
  modelRef.current = model;
  const caseRef = useRef(caseType);
  caseRef.current = caseType;

  const images = useMemo(() => new ImageStore(), []);
  const blobs = useRef(new Map<string, Blob>()); // src → الملف الأصلي (للحفظ التلقائي)

  const past = useRef<Design[]>([]);
  const future = useRef<Design[]>([]);
  const gesture = useRef<{ start: Design } | null>(null);
  const lastCoalesce = useRef<{ key: string; at: number } | null>(null);

  const bump = () => setHistoryTick((n) => n + 1);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'bad' ? 6000 : 3200);
  }, []);

  // ───── التاريخ (تراجع / إعادة) ─────
  const pushPast = (d: Design) => {
    past.current.push(d);
    if (past.current.length > MAX_HISTORY) past.current.shift();
    future.current = [];
  };

  /** تعديل نهائي (يتسجل في التاريخ). coalesce: يدمج التعديلات المتتالية على نفس الحقل (كتابة نص مثلًا) */
  const commit = useCallback((fn: (d: Design) => Design, coalesce?: string) => {
    const cur = designRef.current;
    const next = fn(cur);
    if (next === cur) return;
    if (!gesture.current) {
      const now = Date.now();
      const lc = lastCoalesce.current;
      if (coalesce && lc && lc.key === coalesce && now - lc.at < 900) {
        lastCoalesce.current = { key: coalesce, at: now };
      } else {
        pushPast(cur);
        lastCoalesce.current = coalesce ? { key: coalesce, at: now } : null;
      }
    }
    designRef.current = next;
    setDesign(next);
    bump();
  }, []);

  /** بداية حركة مستمرة (سحب / سلايدر): كل التغييرات لحد النهاية تتحسب خطوة واحدة */
  const beginGesture = useCallback(() => {
    if (gesture.current) return;
    gesture.current = { start: designRef.current };
  }, []);

  const endGesture = useCallback(() => {
    const g = gesture.current;
    gesture.current = null;
    if (g && g.start !== designRef.current) {
      pushPast(g.start);
      lastCoalesce.current = null;
      bump();
    }
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(designRef.current);
    designRef.current = prev;
    setDesign(prev);
    setSelectedId((id) => (id && prev.elements.some((e) => e.id === id) ? id : null));
    lastCoalesce.current = null;
    bump();
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(designRef.current);
    designRef.current = next;
    setDesign(next);
    lastCoalesce.current = null;
    bump();
  }, []);

  // ───── الجراب ─────
  const bleedMm = model ? (caseType === 'wrap3d' ? 12 : model.template.bleedMm) : 3;

  const setCaseType = useCallback((c: CaseType) => {
    setCaseTypeState(c);
    setPref('caseType', c);
  }, []);

  /** تغيير الموديل: نحافظ على التصميم ونعدّل أماكنه نسبيًا على المقاس الجديد */
  const setModel = useCallback(
    (next: DeviceModel) => {
      const old = modelRef.current;
      setModelState(next);
      setPref('modelId', next.id);
      if (old && old.id !== next.id && designRef.current.elements.length) {
        const rw = next.template.widthMm / old.template.widthMm;
        const rh = next.template.heightMm / old.template.heightMm;
        const k = Math.min(rw, rh);
        commit((d) => ({
          ...d,
          elements: d.elements.map((e) => {
            const moved = { ...e, x: e.x * rw, y: e.y * rh } as DesignElement;
            if (e.kind === 'text') return { ...moved, fontSize: e.fontSize * k } as DesignElement;
            return { ...moved, w: e.w * k, h: e.h * k } as DesignElement;
          }),
        }));
      }
    },
    [commit]
  );

  // ───── العناصر ─────
  const updateElement = useCallback(
    (id: string, patch: Partial<DesignElement>, coalesce?: string) => {
      commit(
        (d) => ({
          ...d,
          elements: d.elements.map((e) => (e.id === id ? ({ ...e, ...patch } as DesignElement) : e)),
        }),
        coalesce
      );
    },
    [commit]
  );

  const removeElement = useCallback(
    (id: string) => {
      commit((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
      setSelectedId((s) => (s === id ? null : s));
    },
    [commit]
  );

  const duplicateElement = useCallback(
    (id: string) => {
      const el = designRef.current.elements.find((e) => e.id === id);
      if (!el) return;
      const copy = { ...el, id: uid(), x: el.x + 4, y: el.y + 4, locked: false } as DesignElement;
      commit((d) => ({ ...d, elements: [...d.elements, copy] }));
      setSelectedId(copy.id);
    },
    [commit]
  );

  const moveLayer = useCallback(
    (id: string, dir: 'up' | 'down' | 'front' | 'back') => {
      commit((d) => {
        const i = d.elements.findIndex((e) => e.id === id);
        if (i < 0) return d;
        const arr = [...d.elements];
        const [el] = arr.splice(i, 1);
        const j = dir === 'up' ? Math.min(arr.length, i + 1) : dir === 'down' ? Math.max(0, i - 1) : dir === 'front' ? arr.length : 0;
        arr.splice(j, 0, el);
        return { ...d, elements: arr };
      });
    },
    [commit]
  );

  const setBackground = useCallback((bg: Design['background']) => commit((d) => ({ ...d, background: bg }), 'bg'), [commit]);

  // ───── الصور ─────
  const addImages = useCallback(
    async (files: File[]): Promise<void> => {
      const m = modelRef.current;
      if (!m) return;
      const t = m.template;
      const bleed = caseRef.current === 'wrap3d' ? 12 : t.bleedMm;
      const made: ImageElement[] = [];
      for (const file of files) {
        if (!file.type.startsWith('image/') && !/\.(heic|heif|jpe?g|png|webp|gif|avif)$/i.test(file.name)) {
          toast(`"${file.name}" مش صورة`, 'warn');
          continue;
        }
        if (file.size > MAX_FILE_MB * 1048576) {
          toast(`"${file.name}" أكبر من ${MAX_FILE_MB} ميجا`, 'warn');
          continue;
        }
        const src = URL.createObjectURL(file);
        try {
          const img = await images.load(src);
          blobs.current.set(src, file);
          const firstEver = designRef.current.elements.length === 0 && made.length === 0;
          const el = newImage(
            src,
            img.naturalWidth,
            img.naturalHeight,
            t.widthMm / 2,
            t.heightMm / 2,
            t.widthMm * 0.8,
            t.heightMm * 0.6,
            file.name.replace(/\.[^.]+$/, '')
          );
          if (firstEver) Object.assign(el, coverBox(el, t.widthMm, t.heightMm, bleed));
          else {
            const n = designRef.current.elements.length + made.length;
            el.x += ((n % 4) - 1.5) * 3;
            el.y += ((n % 4) - 1.5) * 3;
          }
          made.push(el);
        } catch {
          URL.revokeObjectURL(src);
          toast(`ما قدرتش أقرأ "${file.name}". لو الصورة HEIC حوّلها JPG الأول.`, 'bad');
        }
      }
      if (made.length) {
        commit((d) => ({ ...d, elements: [...d.elements, ...made] }));
        setSelectedId(made[made.length - 1].id);
      }
    },
    [commit, images, toast]
  );

  const addText = useCallback(
    (text: string, fontFamily: string, fill: string) => {
      const m = modelRef.current;
      if (!m) return;
      const el = newText(text, m.template.widthMm / 2, m.template.heightMm * 0.5, fontFamily, 9, fill);
      commit((d) => ({ ...d, elements: [...d.elements, el] }));
      setSelectedId(el.id);
    },
    [commit]
  );

  const addShape = useCallback(
    (shape: ShapeKind, fill: string) => {
      const m = modelRef.current;
      if (!m) return;
      const el = newShape(shape, m.template.widthMm / 2, m.template.heightMm / 2, Math.min(m.template.widthMm * 0.5, 40), fill);
      commit((d) => ({ ...d, elements: [...d.elements, el] }));
      setSelectedId(el.id);
    },
    [commit]
  );

  const setAdjust = useCallback(
    (id: string, patch: Partial<ImageAdjust>) => {
      commit((d) => ({
        ...d,
        elements: d.elements.map((e) => (e.id === id && e.kind === 'image' ? { ...e, adjust: { ...e.adjust, ...patch } } : e)),
      }));
    },
    [commit]
  );

  // ───── جديد / استرجاع ─────
  const resetDesign = useCallback(() => {
    commit(() => EMPTY_DESIGN);
    setSelectedId(null);
    clearDraft();
  }, [commit]);

  // ───── حفظ تلقائي ─────
  const [draftRestored, setDraftRestored] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!model || !draftRestored) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const els = design.elements;
      if (!els.length && design.background.type === 'solid' && design.background.color.toUpperCase() === '#FFFFFF') {
        clearDraft();
        return;
      }
      const b: Record<string, Blob> = {};
      for (const e of els)
        if (e.kind === 'image') {
          const blob = blobs.current.get(e.src);
          if (blob) b[e.src] = blob;
        }
      saveDraft({ modelId: model.id, caseType, design, blobs: b, savedAt: Date.now() });
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [design, model, caseType, draftRestored]);

  /** رجّع آخر تصميم محفوظ (لو فيه) */
  const restoreDraft = useCallback(
    async (findModel: (id: string) => DeviceModel | undefined): Promise<boolean> => {
      const d = await loadDraft();
      setDraftRestored(true);
      if (!d) return false;
      const m = findModel(d.modelId);
      if (!m) return false;
      const urlFor = new Map<string, string>();
      for (const [oldSrc, blob] of Object.entries(d.blobs)) {
        const url = URL.createObjectURL(blob);
        urlFor.set(oldSrc, url);
        blobs.current.set(url, blob);
      }
      const elements = d.design.elements
        .map((e) => (e.kind === 'image' ? ({ ...e, src: urlFor.get(e.src) ?? '' } as ImageElement) : e))
        .filter((e) => e.kind !== 'image' || e.src);
      await Promise.all(elements.filter((e): e is ImageElement => e.kind === 'image').map((e) => images.load(e.src).catch(() => null)));
      setCaseTypeState(d.caseType);
      setModelState(m);
      const restored = { ...d.design, elements };
      designRef.current = restored;
      setDesign(restored);
      return elements.length > 0;
    },
    [images]
  );

  const initPrefs = useCallback(() => {
    setCaseTypeState(getPref<CaseType>('caseType', 'flat'));
  }, []);

  return {
    model,
    setModel,
    modelRef,
    caseType,
    setCaseType,
    bleedMm,
    design,
    designRef,
    selectedId,
    setSelectedId,
    selected: design.elements.find((e) => e.id === selectedId) ?? null,
    images,
    commit,
    beginGesture,
    endGesture,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    updateElement,
    removeElement,
    duplicateElement,
    moveLayer,
    setBackground,
    addImages,
    addText,
    addShape,
    setAdjust,
    resetDesign,
    restoreDraft,
    initPrefs,
    toast,
    toasts,
  };
}

/** يخلّي الصورة تغطي الجراب بالكامل مع الـ bleed (بقص الزيادة) */
export function coverBox(el: ImageElement, trimW: number, trimH: number, bleed: number): Partial<ImageElement> {
  const bw = trimW + bleed * 2;
  const bh = trimH + bleed * 2;
  const slotRatio = bw / bh;
  const imgRatio = el.nw / el.nh;
  let cw = 1;
  let ch = 1;
  if (imgRatio > slotRatio) cw = slotRatio / imgRatio;
  else ch = imgRatio / slotRatio;
  return { x: trimW / 2, y: trimH / 2, w: bw, h: bh, rotation: 0, crop: { x: (1 - cw) / 2, y: (1 - ch) / 2, w: cw, h: ch } };
}

/** يظبط الصورة كاملة جوه الجراب بدون قص */
export function containBox(el: ImageElement, trimW: number, trimH: number): Partial<ImageElement> {
  const ratio = el.nw / el.nh;
  let w = trimW;
  let h = w / ratio;
  if (h > trimH) {
    h = trimH;
    w = h * ratio;
  }
  return { x: trimW / 2, y: trimH / 2, w, h, rotation: 0, crop: { x: 0, y: 0, w: 1, h: 1 } };
}

export { NEUTRAL_ADJUST };
