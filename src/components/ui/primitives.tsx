'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import clsx from 'clsx';

export function cx(...a: Parameters<typeof clsx>) {
  return clsx(...a);
}

export function IconButton({
  label,
  onClick,
  children,
  active,
  disabled,
  className,
  size = 'md',
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-35',
        size === 'md' ? 'h-10 w-10' : 'h-9 w-9',
        active ? 'bg-ink text-white' : 'text-ink hover:bg-sunken',
        className
      )}
    >
      {children}
    </button>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
  onStart,
  onEnd,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  onStart?: () => void;
  onEnd?: () => void;
}) {
  const shown = Math.round(value * 10) / 10;
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-2">{label}</span>
        <span className="num text-xs text-ink-3">
          {shown}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onStart}
        onPointerUp={onEnd}
        onKeyDown={onStart}
        onKeyUp={onEnd}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('inline-flex w-full rounded-lg bg-sunken p-1', className)} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex min-h-[34px] flex-1 items-center justify-center gap-1 rounded-md px-2 text-[13px] font-medium transition-colors',
            value === o.value ? 'bg-white text-ink shadow-sm' : 'text-ink-2 hover:text-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const PALETTE = [
  '#FFFFFF',
  '#F4F1EA',
  '#1D1B17',
  '#D6451F',
  '#F2A33A',
  '#F5D547',
  '#2E7D4F',
  '#1F6F8B',
  '#2B4A9B',
  '#7B4EA3',
  '#D9608C',
  '#8C5A3C',
  '#9A9A9A',
  '#0B3D2E',
];

export function ColorField({
  label,
  value,
  onChange,
  onStart,
  onEnd,
  palette = PALETTE,
}: {
  label?: string;
  value: string;
  onChange: (c: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
  palette?: string[];
}) {
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex flex-wrap items-center gap-1.5">
        {palette.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            onClick={() => {
              onStart?.();
              onChange(c);
              onEnd?.();
            }}
            className={cx(
              'h-8 w-8 rounded-full border transition-transform',
              value.toLowerCase() === c.toLowerCase() ? 'scale-110 border-ink ring-2 ring-ink/25' : 'border-line hover:scale-105'
            )}
            style={{ background: c }}
          />
        ))}
        <label
          className="relative h-8 w-8 overflow-hidden rounded-full border border-line"
          title="لون مخصص"
          style={{ background: 'conic-gradient(#d6451f,#f5d547,#2e7d4f,#1f6f8b,#7b4ea3,#d6451f)' }}
        >
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'}
            onPointerDown={onStart}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onEnd}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="لون مخصص"
          />
        </label>
      </div>
    </div>
  );
}

export function Section({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cx('space-y-3 border-b border-line px-4 py-4 last:border-b-0', className)}>
      {title && <h3 className="text-[13px] font-bold text-ink">{title}</h3>}
      {children}
    </section>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-ink' : 'bg-line')}
      >
        <span
          className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'start-[22px]' : 'start-0.5')}
        />
      </button>
      <span className="min-w-0 flex-1" onClick={() => onChange(!checked)}>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs leading-relaxed text-ink-3">{hint}</span>}
      </span>
    </label>
  );
}

/** نافذة: على الموبايل تطلع من تحت، وعلى الكمبيوتر في النص */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/45 sm:items-center sm:p-6"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'sheet-in flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-paper shadow-pop outline-none sm:max-h-[88dvh] sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        )}
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-bold">{title}</h2>
          <IconButton label="إغلاق" onClick={onClose} size="sm">
            <X className="h-5 w-5" />
          </IconButton>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <footer className="border-t border-line bg-white px-4 py-3 pb-[max(0.75rem,var(--safe-bottom))]">{footer}</footer>}
      </div>
    </div>
  );
}
