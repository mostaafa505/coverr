'use client';

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Heart,
  ImagePlus,
  Italic,
  Lock,
  Maximize2,
  Minimize2,
  Move,
  RotateCw,
  Square,
  Star,
  Trash2,
  Triangle,
  Circle as CircleIcon,
  Unlock,
  Type,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { Background, DesignElement, ImageAdjust, ImageElement, ShapeElement, ShapeKind, TextElement } from '@/types';
import { FONTS } from '@/lib/design/fonts';
import { elementLabel, NEUTRAL_ADJUST } from '@/lib/design/elements';
import { imageDpi } from '@/lib/design/preflight';
import { ColorField, cx, IconButton, Section, Segmented, Slider } from '@/components/ui/primitives';
import { containBox, coverBox, type useStudio } from './useStudio';

type Studio = ReturnType<typeof useStudio>;

// ───────────────────────── الصور ─────────────────────────

export function ImagesPanel({ studio }: { studio: Studio }) {
  const input = useRef<HTMLInputElement>(null);
  const m = studio.model;
  const t = m?.template;
  const idealW = t ? Math.round(((t.widthMm + studio.bleedMm * 2) / 25.4) * 300) : 0;
  const idealH = t ? Math.round(((t.heightMm + studio.bleedMm * 2) / 25.4) * 300) : 0;
  const images = studio.design.elements.filter((e): e is ImageElement => e.kind === 'image');

  return (
    <div>
      <Section>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (files.length) studio.addImages(files);
          }}
        />
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-line bg-white px-4 py-7 text-center transition-colors hover:border-ink-3 active:bg-sunken"
        >
          <ImagePlus className="h-7 w-7 text-accent" />
          <span className="text-sm font-bold">اختار صورة من جهازك</span>
          <span className="hidden text-xs text-ink-3 lg:block">أو اسحبها وسيبها على الجراب</span>
        </button>
        {t && (
          <p className="rounded-lg bg-sunken px-3 py-2.5 text-xs leading-relaxed text-ink-2">
            عشان تطلع بأعلى جودة، الصورة اللي تغطي الجراب كله يفضّل تكون على الأقل{' '}
            <b className="num">
              {idealW} × {idealH}
            </b>{' '}
            بكسل.
          </p>
        )}
      </Section>
      {images.length > 0 && (
        <Section title="صور التصميم">
          <ul className="grid grid-cols-4 gap-2">
            {images.map((im) => (
              <li key={im.id}>
                <button
                  type="button"
                  onClick={() => studio.setSelectedId(im.id)}
                  className={cx(
                    'aspect-square w-full overflow-hidden rounded-lg border bg-white',
                    studio.selectedId === im.id ? 'border-ink ring-2 ring-ink/20' : 'border-line'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.src} alt={im.name ?? 'صورة'} className="h-full w-full object-cover" draggable={false} />
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

// ───────────────────────── النص ─────────────────────────

export function TextPanel({ studio }: { studio: Studio }) {
  const [text, setText] = useState('اكتب هنا');
  const [font, setFont] = useState('Cairo');
  const [color, setColor] = useState('#1D1B17');
  return (
    <div>
      <Section>
        <label className="label" htmlFor="newtext">
          النص
        </label>
        <textarea
          id="newtext"
          className="field min-h-[72px] resize-none leading-relaxed"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          dir="auto"
        />
        <FontGrid value={font} onChange={setFont} sample={text} />
        <ColorField label="اللون" value={color} onChange={setColor} />
        <button type="button" className="btn btn-primary w-full" onClick={() => studio.addText(text.trim() || 'نص', font, color)}>
          <Type className="h-4 w-4" />
          إضافة النص للتصميم
        </button>
      </Section>
    </div>
  );
}

function FontGrid({ value, onChange, sample }: { value: string; onChange: (f: string) => void; sample: string }) {
  const word = (sample.split('\n')[0] || 'نص').slice(0, 14);
  return (
    <div>
      <span className="label">الخط</span>
      <div className="grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto pe-1">
        {FONTS.map((f) => (
          <button
            key={f.family}
            type="button"
            onClick={() => onChange(f.family)}
            className={cx(
              'flex min-h-[48px] items-center justify-center rounded-lg border bg-white px-2 text-lg leading-tight transition-colors',
              value === f.family ? 'border-ink ring-1 ring-ink' : 'border-line hover:border-ink-3'
            )}
            style={{ fontFamily: `"${f.family}", sans-serif` }}
            title={f.label}
          >
            <span className="truncate">
              {f.group === 'ar' ? (/[؀-ۿ]/.test(word) ? word : 'خط عربي') : /[A-Za-z]/.test(word) ? word : 'Aa Bb'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── الأشكال ─────────────────────────

const SHAPES: { kind: ShapeKind; label: string; icon: React.ReactNode }[] = [
  { kind: 'rect', label: 'مستطيل', icon: <Square className="h-6 w-6" /> },
  { kind: 'ellipse', label: 'دائرة', icon: <CircleIcon className="h-6 w-6" /> },
  { kind: 'triangle', label: 'مثلث', icon: <Triangle className="h-6 w-6" /> },
  { kind: 'heart', label: 'قلب', icon: <Heart className="h-6 w-6" /> },
  { kind: 'star', label: 'نجمة', icon: <Star className="h-6 w-6" /> },
];

export function ShapesPanel({ studio }: { studio: Studio }) {
  const [color, setColor] = useState('#D6451F');
  return (
    <Section>
      <div className="grid grid-cols-3 gap-2">
        {SHAPES.map((s) => (
          <button
            key={s.kind}
            type="button"
            onClick={() => studio.addShape(s.kind, color)}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-white text-ink transition-colors hover:border-ink-3 active:bg-sunken"
          >
            {s.icon}
            <span className="text-xs text-ink-2">{s.label}</span>
          </button>
        ))}
      </div>
      <ColorField label="لون الشكل" value={color} onChange={setColor} />
    </Section>
  );
}

// ───────────────────────── الخلفية ─────────────────────────

const GRADIENTS: [string, string, number][] = [
  ['#F6D365', '#FDA085', 160],
  ['#1D2B64', '#F8CDDA', 160],
  ['#0F2027', '#2C5364', 160],
  ['#FF9966', '#FF5E62', 135],
  ['#134E5E', '#71B280', 160],
  ['#614385', '#516395', 160],
  ['#232526', '#414345', 160],
  ['#E8CBC0', '#636FA4', 135],
];

export function BackgroundPanel({ studio }: { studio: Studio }) {
  const bg = studio.design.background;
  const solid = bg.type === 'solid' ? bg.color : '#FFFFFF';
  const set = (b: Background) => studio.setBackground(b);
  return (
    <div>
      <Section title="لون سادة">
        <ColorField value={solid} onChange={(c) => set({ type: 'solid', color: c })} />
      </Section>
      <Section title="تدرّج">
        <div className="grid grid-cols-4 gap-2">
          {GRADIENTS.map(([from, to, angle]) => (
            <button
              key={from + to}
              type="button"
              aria-label={`تدرج ${from} إلى ${to}`}
              onClick={() => set({ type: 'gradient', from, to, angle })}
              className={cx(
                'aspect-square rounded-lg border',
                bg.type === 'gradient' && bg.from === from && bg.to === to ? 'border-ink ring-2 ring-ink/25' : 'border-line'
              )}
              style={{ background: `linear-gradient(${angle}deg, ${from}, ${to})` }}
            />
          ))}
        </div>
        {bg.type === 'gradient' && (
          <div className="space-y-3">
            <Slider
              label="الاتجاه"
              value={bg.angle}
              min={0}
              max={360}
              unit="°"
              onChange={(v) => set({ ...bg, angle: v })}
              onStart={studio.beginGesture}
              onEnd={studio.endGesture}
            />
            <div className="grid grid-cols-2 gap-3">
              <ColorField
                label="من"
                value={bg.from}
                palette={[]}
                onChange={(c) => set({ ...bg, from: c })}
                onStart={studio.beginGesture}
                onEnd={studio.endGesture}
              />
              <ColorField
                label="إلى"
                value={bg.to}
                palette={[]}
                onChange={(c) => set({ ...bg, to: c })}
                onStart={studio.beginGesture}
                onEnd={studio.endGesture}
              />
            </div>
          </div>
        )}
      </Section>
      <Section title="بدون خلفية">
        <button
          type="button"
          className={cx('btn w-full', bg.type === 'transparent' && 'border-ink')}
          onClick={() => set({ type: 'transparent' })}
        >
          خلفية شفافة
        </button>
        <p className="text-xs leading-relaxed text-ink-3">للطباعة على جراب شفاف أو الـ UV / DTF لما عايز الحبر يتطبع على التصميم بس.</p>
      </Section>
    </div>
  );
}

// ───────────────────────── الكولاج ─────────────────────────

type Slot = [number, number, number, number];
const LAYOUTS: { id: string; label: string; slots: Slot[] }[] = [
  {
    id: 'h2',
    label: 'صورتين فوق بعض',
    slots: [
      [0, 0, 1, 0.5],
      [0, 0.5, 1, 0.5],
    ],
  },
  {
    id: 'v2',
    label: 'صورتين جنب بعض',
    slots: [
      [0, 0, 0.5, 1],
      [0.5, 0, 0.5, 1],
    ],
  },
  {
    id: 'rows3',
    label: 'ثلاث صفوف',
    slots: [
      [0, 0, 1, 1 / 3],
      [0, 1 / 3, 1, 1 / 3],
      [0, 2 / 3, 1, 1 / 3],
    ],
  },
  {
    id: 't1b2',
    label: 'كبيرة وصغيرتين',
    slots: [
      [0, 0, 1, 0.55],
      [0, 0.55, 0.5, 0.45],
      [0.5, 0.55, 0.5, 0.45],
    ],
  },
  {
    id: 'l1r2',
    label: 'طولية وصغيرتين',
    slots: [
      [0, 0, 0.5, 1],
      [0.5, 0, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
    ],
  },
  {
    id: 'g4',
    label: 'أربع صور',
    slots: [
      [0, 0, 0.5, 0.5],
      [0.5, 0, 0.5, 0.5],
      [0, 0.5, 0.5, 0.5],
      [0.5, 0.5, 0.5, 0.5],
    ],
  },
  {
    id: 'hero3',
    label: 'كبيرة وثلاث',
    slots: [
      [0, 0, 1, 0.6],
      [0, 0.6, 1 / 3, 0.4],
      [1 / 3, 0.6, 1 / 3, 0.4],
      [2 / 3, 0.6, 1 / 3, 0.4],
    ],
  },
];

export function CollagePanel({ studio }: { studio: Studio }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<(typeof LAYOUTS)[number] | null>(null);

  const apply = (layout: (typeof LAYOUTS)[number]) => {
    const m = studio.modelRef.current;
    if (!m) return;
    const t = m.template;
    const b = studio.bleedMm;
    const gap = 2;
    const imgs = studio.designRef.current.elements
      .filter((e): e is ImageElement => e.kind === 'image' && !e.hidden && !e.locked)
      .slice(-layout.slots.length);
    if (!imgs.length) {
      studio.toast('ضيف صور الأول', 'warn');
      return;
    }
    studio.commit((d) => ({
      ...d,
      elements: d.elements.map((e) => {
        const idx = imgs.findIndex((i) => i.id === e.id);
        if (idx < 0 || e.kind !== 'image') return e;
        const [fx, fy, fw, fh] = layout.slots[idx];
        const x1 = fx === 0 ? -b : fx * t.widthMm + gap / 2;
        const y1 = fy === 0 ? -b : fy * t.heightMm + gap / 2;
        const x2 = fx + fw >= 0.999 ? t.widthMm + b : (fx + fw) * t.widthMm - gap / 2;
        const y2 = fy + fh >= 0.999 ? t.heightMm + b : (fy + fh) * t.heightMm - gap / 2;
        const sw = x2 - x1;
        const sh = y2 - y1;
        const ratio = e.nw / e.nh;
        const slotRatio = sw / sh;
        let cw = 1;
        let ch = 1;
        if (ratio > slotRatio) cw = slotRatio / ratio;
        else ch = ratio / slotRatio;
        return {
          ...e,
          x: x1 + sw / 2,
          y: y1 + sh / 2,
          w: sw,
          h: sh,
          rotation: 0,
          crop: { x: (1 - cw) / 2, y: (1 - ch) / 2, w: cw, h: ch },
        };
      }),
    }));
    if (imgs.length < layout.slots.length) studio.toast(`الترتيب فيه ${layout.slots.length} خانات وانت ضفت ${imgs.length} صور بس`, 'warn');
  };

  const choose = async (l: (typeof LAYOUTS)[number]) => {
    const have = studio.designRef.current.elements.filter((e) => e.kind === 'image' && !e.hidden && !e.locked).length;
    if (have >= l.slots.length) apply(l);
    else {
      setPending(l);
      input.current?.click();
    }
  };

  return (
    <Section>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          if (files.length) await studio.addImages(files);
          if (pending) apply(pending);
          setPending(null);
        }}
      />
      <p className="text-xs leading-relaxed text-ink-3">
        اختار شكل التقسيم وبعدين اختار الصور. بتتوزع تلقائيًا وتتقص على قد الخانة، وتقدر تعدّل كل صورة بعد كده.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {LAYOUTS.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => choose(l)}
            className="group flex flex-col items-center gap-1.5 rounded-xl border border-line bg-white p-2 transition-colors hover:border-ink-3 active:bg-sunken"
            title={l.label}
          >
            <svg viewBox="0 0 40 70" className="h-20 w-auto" aria-hidden>
              <rect x="0.5" y="0.5" width="39" height="69" rx="6" fill="none" stroke="#8A857A" />
              {l.slots.map(([x, y, w, h], i) => (
                <rect
                  key={i}
                  x={x * 36 + 2.5}
                  y={y * 66 + 2}
                  width={w * 36 - 1}
                  height={h * 66 - 1}
                  rx="2"
                  fill="#D6451F"
                  opacity={0.18 + (i % 3) * 0.14}
                />
              ))}
            </svg>
            <span className="text-[11px] leading-tight text-ink-2">{l.label}</span>
          </button>
        ))}
      </div>
    </Section>
  );
}

// ───────────────────────── الطبقات ─────────────────────────

export function LayersPanel({ studio }: { studio: Studio }) {
  const els = [...studio.design.elements].reverse();
  if (!els.length)
    return (
      <Section>
        <p className="py-6 text-center text-sm text-ink-3">لسه مفيش عناصر في التصميم.</p>
      </Section>
    );
  return (
    <ul className="divide-y divide-line">
      {els.map((el, i) => (
        <li key={el.id} className={cx('flex items-center gap-2 px-3 py-2', studio.selectedId === el.id && 'bg-white')}>
          <button type="button" onClick={() => studio.setSelectedId(el.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-start">
            <LayerThumb el={el} />
            <span className={cx('truncate text-sm', el.hidden && 'text-ink-3 line-through')}>{elementLabel(el)}</span>
          </button>
          <IconButton size="sm" label={el.hidden ? 'إظهار' : 'إخفاء'} onClick={() => studio.updateElement(el.id, { hidden: !el.hidden })}>
            {el.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </IconButton>
          <IconButton size="sm" label={el.locked ? 'فك القفل' : 'قفل'} onClick={() => studio.updateElement(el.id, { locked: !el.locked })}>
            {el.locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4 text-ink-3" />}
          </IconButton>
          <IconButton size="sm" label="لفوق" disabled={i === 0} onClick={() => studio.moveLayer(el.id, 'up')}>
            <ArrowUp className="h-4 w-4" />
          </IconButton>
          <IconButton size="sm" label="لتحت" disabled={i === els.length - 1} onClick={() => studio.moveLayer(el.id, 'down')}>
            <ArrowDown className="h-4 w-4" />
          </IconButton>
        </li>
      ))}
    </ul>
  );
}

function LayerThumb({ el }: { el: DesignElement }) {
  const box = 'flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-sunken';
  if (el.kind === 'image')
    return (
      <span className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={el.src} alt="" className="h-full w-full object-cover" draggable={false} />
      </span>
    );
  if (el.kind === 'text')
    return (
      <span className={box}>
        <Type className="h-4 w-4 text-ink-2" />
      </span>
    );
  return (
    <span className={box}>
      <span className="h-4 w-4 rounded-sm" style={{ background: el.fill }} />
    </span>
  );
}

// ───────────────────────── خصائص العنصر المحدد ─────────────────────────

const PRESETS: { id: string; label: string; adj: ImageAdjust }[] = [
  { id: 'normal', label: 'أصلي', adj: NEUTRAL_ADJUST },
  { id: 'bw', label: 'أبيض وأسود', adj: { ...NEUTRAL_ADJUST, grayscale: true, contrast: 12 } },
  { id: 'sepia', label: 'قديم', adj: { ...NEUTRAL_ADJUST, sepia: 80, contrast: 6 } },
  { id: 'warm', label: 'دافئ', adj: { ...NEUTRAL_ADJUST, brightness: 4, saturation: 15, sepia: 18 } },
  { id: 'vivid', label: 'زاهي', adj: { ...NEUTRAL_ADJUST, saturation: 40, contrast: 12 } },
  { id: 'fade', label: 'باهت', adj: { ...NEUTRAL_ADJUST, brightness: 8, contrast: -18, saturation: -15 } },
];

export function Inspector({ studio }: { studio: Studio }) {
  const el = studio.selected;
  if (!el) return null;
  const t = studio.model?.template;
  const live = { onStart: studio.beginGesture, onEnd: studio.endGesture };
  const patch = (p: Partial<DesignElement>, coalesce?: string) => studio.updateElement(el.id, p, coalesce);

  return (
    <div>
      <Section>
        <div className="flex flex-wrap gap-1">
          <IconButton label="نسخ" onClick={() => studio.duplicateElement(el.id)}>
            <Copy className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton label="لفوق" onClick={() => studio.moveLayer(el.id, 'up')}>
            <ArrowUp className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton label="لتحت" onClick={() => studio.moveLayer(el.id, 'down')}>
            <ArrowDown className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton label={el.locked ? 'فك القفل' : 'قفل مكانه'} active={!!el.locked} onClick={() => patch({ locked: !el.locked })}>
            {el.locked ? <Lock className="h-[18px] w-[18px]" /> : <Unlock className="h-[18px] w-[18px]" />}
          </IconButton>
          <IconButton label="توسيط" onClick={() => t && patch({ x: t.widthMm / 2, y: t.heightMm / 2 })}>
            <Move className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton label="تدوير 90°" onClick={() => patch({ rotation: ((el.rotation + 90 + 180) % 360) - 180 })}>
            <RotateCw className="h-[18px] w-[18px]" />
          </IconButton>
          <span className="flex-1" />
          <IconButton label="حذف" onClick={() => studio.removeElement(el.id)} className="text-bad hover:bg-bad/10">
            <Trash2 className="h-[18px] w-[18px]" />
          </IconButton>
        </div>
      </Section>

      {el.kind === 'image' && <ImageInspector studio={studio} el={el} patch={patch} live={live} />}
      {el.kind === 'text' && <TextInspector el={el} patch={patch} live={live} />}
      {el.kind === 'shape' && <ShapeInspector el={el} patch={patch} live={live} />}

      <Section title="عام">
        <Slider
          label="الشفافية"
          value={Math.round(el.opacity * 100)}
          min={5}
          max={100}
          unit="%"
          onChange={(v) => patch({ opacity: v / 100 })}
          {...live}
        />
        <Slider
          label="الدوران"
          value={Math.round(el.rotation)}
          min={-180}
          max={180}
          unit="°"
          onChange={(v) => patch({ rotation: v })}
          {...live}
        />
      </Section>
    </div>
  );
}

type Live = { onStart: () => void; onEnd: () => void };

function ImageInspector({
  studio,
  el,
  patch,
  live,
}: {
  studio: Studio;
  el: ImageElement;
  patch: (p: Partial<DesignElement>) => void;
  live: Live;
}) {
  const t = studio.model!.template;
  const dpi = imageDpi(el);
  const tone = dpi >= 280 ? 'text-good' : dpi >= 200 ? 'text-warn' : 'text-bad';
  const note =
    dpi >= 280 ? 'ممتازة للطباعة' : dpi >= 200 ? 'مقبولة' : dpi >= 150 ? 'ضعيفة، التفاصيل هتبقى ناعمة' : 'ضعيفة جدًا، هتطلع مشوشة';
  const adj = el.adjust;
  const setAdj = (p: Partial<ImageAdjust>) => studio.setAdjust(el.id, p);
  return (
    <>
      <Section title="الصورة">
        <div className="flex items-center justify-between rounded-lg bg-sunken px-3 py-2 text-sm">
          <span className="text-ink-2">الدقة على المقاس ده</span>
          <span className={cx('font-bold', tone)}>
            <span className="num">{dpi}</span> DPI · {note}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn" onClick={() => patch(coverBox(el, t.widthMm, t.heightMm, studio.bleedMm))}>
            <Maximize2 className="h-4 w-4" />
            ملء الجراب
          </button>
          <button type="button" className="btn" onClick={() => patch(containBox(el, t.widthMm, t.heightMm))}>
            <Minimize2 className="h-4 w-4" />
            الصورة كاملة
          </button>
          <button type="button" className="btn" onClick={() => patch({ flipX: !el.flipX })}>
            <FlipHorizontal2 className="h-4 w-4" />
            قلب أفقي
          </button>
          <button type="button" className="btn" onClick={() => patch({ flipY: !el.flipY })}>
            <FlipVertical2 className="h-4 w-4" />
            قلب رأسي
          </button>
        </div>
      </Section>
      <Section title="الألوان">
        <div className="grid grid-cols-3 gap-1.5">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="btn !min-h-[36px] !px-2 text-[13px]" onClick={() => setAdj(p.adj)}>
              {p.label}
            </button>
          ))}
        </div>
        <Slider label="السطوع" value={adj.brightness} min={-100} max={100} onChange={(v) => setAdj({ brightness: v })} {...live} />
        <Slider label="التباين" value={adj.contrast} min={-100} max={100} onChange={(v) => setAdj({ contrast: v })} {...live} />
        <Slider label="تشبّع الألوان" value={adj.saturation} min={-100} max={100} onChange={(v) => setAdj({ saturation: v })} {...live} />
      </Section>
    </>
  );
}

function TextInspector({ el, patch, live }: { el: TextElement; patch: (p: Partial<DesignElement>, key?: string) => void; live: Live }) {
  return (
    <>
      <Section title="النص">
        <textarea
          id="edit-text"
          className="field min-h-[72px] resize-none leading-relaxed"
          value={el.text}
          rows={2}
          dir="auto"
          onChange={(e) => patch({ text: e.target.value }, `text-${el.id}`)}
        />
        <FontGrid value={el.fontFamily} onChange={(f) => patch({ fontFamily: f })} sample={el.text} />
        <div className="flex items-center gap-2">
          <Segmented
            className="flex-1"
            value={el.align}
            onChange={(a) => patch({ align: a })}
            options={[
              { value: 'right', label: <AlignRight className="h-4 w-4" />, title: 'يمين' },
              { value: 'center', label: <AlignCenter className="h-4 w-4" />, title: 'وسط' },
              { value: 'left', label: <AlignLeft className="h-4 w-4" />, title: 'شمال' },
            ]}
          />
          <IconButton label="عريض" active={el.bold} onClick={() => patch({ bold: !el.bold })}>
            <Bold className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton label="مائل" active={el.italic} onClick={() => patch({ italic: !el.italic })}>
            <Italic className="h-[18px] w-[18px]" />
          </IconButton>
        </div>
        <Slider
          label="حجم الخط"
          value={el.fontSize}
          min={2}
          max={60}
          step={0.5}
          unit=" مم"
          onChange={(v) => patch({ fontSize: v })}
          {...live}
        />
        <Slider
          label="المسافة بين السطور"
          value={el.lineHeight}
          min={0.9}
          max={2}
          step={0.05}
          onChange={(v) => patch({ lineHeight: v })}
          {...live}
        />
      </Section>
      <Section title="اللون والإطار">
        <ColorField label="لون النص" value={el.fill} onChange={(c) => patch({ fill: c })} {...live} />
        <Slider
          label="سُمك الإطار"
          value={el.strokeWidth}
          min={0}
          max={4}
          step={0.1}
          unit=" مم"
          onChange={(v) => patch({ strokeWidth: v })}
          {...live}
        />
        {el.strokeWidth > 0 && <ColorField label="لون الإطار" value={el.stroke} onChange={(c) => patch({ stroke: c })} {...live} />}
      </Section>
    </>
  );
}

function ShapeInspector({ el, patch, live }: { el: ShapeElement; patch: (p: Partial<DesignElement>) => void; live: Live }) {
  return (
    <>
      <Section title="الشكل">
        <Slider label="العرض" value={el.w} min={2} max={160} step={0.5} unit=" مم" onChange={(v) => patch({ w: v })} {...live} />
        <Slider label="الارتفاع" value={el.h} min={2} max={220} step={0.5} unit=" مم" onChange={(v) => patch({ h: v })} {...live} />
        {el.shape === 'rect' && (
          <Slider
            label="تدوير الزوايا"
            value={el.radius}
            min={0}
            max={Math.min(el.w, el.h) / 2}
            step={0.5}
            unit=" مم"
            onChange={(v) => patch({ radius: v })}
            {...live}
          />
        )}
      </Section>
      <Section title="اللون">
        <ColorField label="التعبئة" value={el.fill} onChange={(c) => patch({ fill: c })} {...live} />
        <Slider
          label="سُمك الإطار"
          value={el.strokeWidth}
          min={0}
          max={6}
          step={0.1}
          unit=" مم"
          onChange={(v) => patch({ strokeWidth: v })}
          {...live}
        />
        {el.strokeWidth > 0 && <ColorField label="لون الإطار" value={el.stroke} onChange={(c) => patch({ stroke: c })} {...live} />}
      </Section>
    </>
  );
}
