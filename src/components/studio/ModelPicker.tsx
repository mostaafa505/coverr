'use client';

import { Plus, Search, Smartphone } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import type { Catalog, DeviceModel } from '@/types';
import { Modal, cx } from '@/components/ui/primitives';
import { getRecentIds } from '@/lib/catalog';

const norm = (s: string) => s.toLowerCase().replace(/[\s\-_.]+/g, '');
const PAGE = 80;

export default function ModelPicker({
  open,
  catalog,
  currentId,
  onPick,
  onClose,
  onAddCustom,
}: {
  open: boolean;
  catalog: Catalog;
  currentId?: string;
  onPick: (m: DeviceModel) => void;
  onClose: () => void;
  onAddCustom: () => void;
}) {
  const [q, setQ] = useState('');
  const [brand, setBrand] = useState('all');
  const [limit, setLimit] = useState(PAGE);
  const dq = useDeferredValue(q);

  const brandName = useMemo(() => new Map(catalog.brands.map((b) => [b.id, b])), [catalog]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const x of catalog.models) m.set(x.brandId, (m.get(x.brandId) ?? 0) + 1);
    return m;
  }, [catalog]);

  const recents = useMemo(() => {
    if (!open) return [];
    const byId = new Map(catalog.models.map((m) => [m.id, m]));
    return getRecentIds()
      .map((id) => byId.get(id))
      .filter(Boolean) as DeviceModel[];
  }, [open, catalog]);

  const list = useMemo(() => {
    const key = norm(dq);
    return catalog.models
      .filter((m) => {
        if (brand !== 'all' && m.brandId !== brand) return false;
        if (!key) return true;
        const b = brandName.get(m.brandId);
        const hay = norm([m.name, ...(m.aliases ?? []), b?.name ?? '', b?.nameAr ?? ''].join(' '));
        return key.split(/\s+/).every((k) => hay.includes(norm(k)));
      })
      .sort((a, b) => b.releaseYear - a.releaseYear || a.name.localeCompare(b.name));
  }, [catalog, dq, brand, brandName]);

  const brands = catalog.brands.filter((b) => counts.get(b.id));
  const showRecents = !dq && brand === 'all' && recents.length > 0;

  return (
    <Modal open={open} onClose={onClose} title="اختار موديل الموبايل" wide>
      <div className="sticky top-0 z-10 space-y-2.5 border-b border-line bg-paper px-4 pb-3 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            className="field !ps-9"
            placeholder="ابحث بالاسم أو الكود (مثال: note 13 أو SM-S938B)"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setLimit(PAGE);
            }}
            autoFocus={typeof window !== 'undefined' && window.matchMedia('(pointer:fine)').matches}
            inputMode="search"
            enterKeyHint="search"
          />
        </div>
        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          <Chip active={brand === 'all'} onClick={() => setBrand('all')}>
            الكل <span className="num text-ink-3">{catalog.models.length}</span>
          </Chip>
          {brands.map((b) => (
            <Chip
              key={b.id}
              active={brand === b.id}
              onClick={() => {
                setBrand(b.id);
                setLimit(PAGE);
              }}
            >
              {b.nameAr}
            </Chip>
          ))}
        </div>
      </div>

      {showRecents && (
        <div className="px-4 pt-3">
          <h3 className="mb-1.5 text-xs font-bold text-ink-3">آخر ما استخدمت</h3>
          <ul className="flex flex-wrap gap-1.5">
            {recents.slice(0, 6).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-[13px] hover:bg-sunken"
                >
                  {m.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ul className="px-2 py-2">
        {list.slice(0, limit).map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => onPick(m)}
              className={cx(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-white',
                m.id === currentId && 'bg-white ring-1 ring-ink'
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sunken text-ink-2">
                <Smartphone className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{m.name}</span>
                <span className="block truncate text-xs text-ink-3">
                  {brandName.get(m.brandId)?.nameAr} · {m.releaseYear}
                  {m.aliases?.[0] ? ` · ${m.aliases[0]}` : ''}
                </span>
              </span>
              <span className="num shrink-0 text-xs text-ink-3">
                {m.template.widthMm} × {m.template.heightMm}
              </span>
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="px-4 py-10 text-center">
            <p className="text-sm text-ink-2">مفيش موديل بالاسم ده.</p>
            <p className="mt-1 text-xs text-ink-3">تقدر تضيفه بنفسك وتكتب مقاسه.</p>
          </li>
        )}
        {list.length > limit && (
          <li className="px-2 pt-2">
            <button type="button" className="btn w-full" onClick={() => setLimit((l) => l + PAGE)}>
              عرض المزيد ({list.length - limit})
            </button>
          </li>
        )}
      </ul>

      <div className="border-t border-line px-4 py-3">
        <button type="button" className="btn w-full" onClick={onAddCustom}>
          <Plus className="h-4 w-4" />
          موديل مش موجود؟ أضفه بمقاسه
        </button>
      </div>
    </Modal>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'inline-flex min-h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] transition-colors',
        active ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:text-ink'
      )}
    >
      {children}
    </button>
  );
}
