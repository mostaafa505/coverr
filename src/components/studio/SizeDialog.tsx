'use client';

import { Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Cutout, DeviceModel, PrintTemplate } from '@/types';
import { Modal, cx } from '@/components/ui/primitives';
import { uid } from '@/lib/design/elements';

function Num({
  label,
  value,
  onChange,
  step = 0.1,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="field num text-center"
        dir="ltr"
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

const blank = (): PrintTemplate => ({
  widthMm: 75,
  heightMm: 160,
  cornerRadiusMm: 8,
  bleedMm: 3,
  safeMarginMm: 3,
  cutouts: [{ id: 'cam', name: 'الكاميرا', type: 'camera', shape: 'rounded-rect', xMm: 6, yMm: 6, widthMm: 30, heightMm: 40, radiusMm: 8 }],
});

export default function SizeDialog({
  open,
  mode,
  model,
  hasOverride,
  onClose,
  onSave,
  onReset,
}: {
  open: boolean;
  mode: 'edit' | 'new';
  model: DeviceModel | null;
  hasOverride: boolean;
  onClose: () => void;
  onSave: (t: PrintTemplate, name?: string) => void;
  onReset: () => void;
}) {
  const [t, setT] = useState<PrintTemplate>(blank());
  const [name, setName] = useState('');

  useEffect(() => {
    if (!open) return;
    if (mode === 'new') {
      setT(blank());
      setName('');
    } else if (model) {
      setT(JSON.parse(JSON.stringify(model.template)));
      setName(model.name);
    }
  }, [open, mode, model]);

  const num = (v: number, fb: number) => (Number.isFinite(v) ? v : fb);
  const setCut = (i: number, p: Partial<Cutout>) =>
    setT((s) => ({ ...s, cutouts: s.cutouts.map((c, j) => (j === i ? { ...c, ...p } : c)) }));
  const valid = t.widthMm >= 40 && t.widthMm <= 120 && t.heightMm >= 80 && t.heightMm <= 220 && (mode === 'edit' || name.trim().length > 0);

  // معاينة صغيرة
  const vw = t.widthMm;
  const vh = t.heightMm;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'new' ? 'إضافة موديل جديد' : 'ضبط مقاس الجراب'}
      wide
      footer={
        <div className="flex items-center gap-2">
          {mode === 'edit' && hasOverride && (
            <button type="button" className="btn" onClick={onReset}>
              <RotateCcw className="h-4 w-4" />
              المقاس الأصلي
            </button>
          )}
          <span className="flex-1" />
          <button type="button" className="btn" onClick={onClose}>
            إلغاء
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!valid}
            onClick={() =>
              onSave(
                {
                  ...t,
                  widthMm: num(t.widthMm, 75),
                  heightMm: num(t.heightMm, 160),
                  cornerRadiusMm: num(t.cornerRadiusMm, 8),
                  cutouts: t.cutouts.map((c) => ({
                    ...c,
                    xMm: num(c.xMm, 0),
                    yMm: num(c.yMm, 0),
                    widthMm: num(c.widthMm, 10),
                    heightMm: num(c.heightMm, 10),
                    radiusMm: num(c.radiusMm ?? 0, 0),
                  })),
                },
                name.trim()
              )
            }
          >
            حفظ
          </button>
        </div>
      }
    >
      <div className="grid gap-5 p-4 sm:grid-cols-[1fr_150px]">
        <div className="space-y-4">
          {mode === 'edit' ? (
            <p className="rounded-lg bg-sunken px-3 py-2.5 text-xs leading-relaxed text-ink-2">
              قِس الجراب الفعلي بالمسطرة أو من ملف المورّد وعدّل الأرقام هنا. التعديل بيتحفظ على الجهاز ده فقط لموديل <b>{model?.name}</b>.
            </p>
          ) : (
            <label className="block">
              <span className="label">اسم الموديل</span>
              <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: Infinix Hot 40" />
            </label>
          )}
          <div className="grid grid-cols-3 gap-3">
            <Num label="العرض (مم)" value={t.widthMm} onChange={(v) => setT({ ...t, widthMm: v })} />
            <Num label="الطول (مم)" value={t.heightMm} onChange={(v) => setT({ ...t, heightMm: v })} />
            <Num label="تدوير الزوايا" value={t.cornerRadiusMm} onChange={(v) => setT({ ...t, cornerRadiusMm: v })} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-bold">الفتحات (كاميرا / فلاش / بصمة)</h3>
              <button
                type="button"
                className="btn !min-h-[34px] !px-2.5 text-[13px]"
                onClick={() =>
                  setT({
                    ...t,
                    cutouts: [
                      ...t.cutouts,
                      {
                        id: uid(),
                        name: 'فتحة',
                        type: 'camera',
                        shape: 'rounded-rect',
                        xMm: 8,
                        yMm: 8,
                        widthMm: 12,
                        heightMm: 12,
                        radiusMm: 4,
                      },
                    ],
                  })
                }
              >
                <Plus className="h-4 w-4" />
                فتحة
              </button>
            </div>
            <ul className="space-y-2.5">
              {t.cutouts.map((c, i) => (
                <li key={c.id} className="rounded-xl border border-line bg-white p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input
                      className="field !min-h-[36px] flex-1"
                      value={c.name}
                      onChange={(e) => setCut(i, { name: e.target.value })}
                      aria-label="اسم الفتحة"
                    />
                    <button
                      type="button"
                      className={cx('btn !min-h-[36px] !px-2.5 text-[13px]', c.shape === 'circle' && 'border-ink')}
                      onClick={() => setCut(i, { shape: c.shape === 'circle' ? 'rounded-rect' : 'circle' })}
                    >
                      {c.shape === 'circle' ? 'دائرة' : 'مستطيل'}
                    </button>
                    <button
                      type="button"
                      aria-label="حذف الفتحة"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-bad hover:bg-bad/10"
                      onClick={() => setT({ ...t, cutouts: t.cutouts.filter((_, j) => j !== i) })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <Num label="من اليسار" value={c.xMm} onChange={(v) => setCut(i, { xMm: v })} />
                    <Num label="من فوق" value={c.yMm} onChange={(v) => setCut(i, { yMm: v })} />
                    <Num label="العرض" value={c.widthMm} onChange={(v) => setCut(i, { widthMm: v })} />
                    <Num label="الطول" value={c.heightMm} onChange={(v) => setCut(i, { heightMm: v })} />
                  </div>
                </li>
              ))}
              {t.cutouts.length === 0 && <li className="text-xs text-ink-3">من غير فتحات.</li>}
            </ul>
            <p className="mt-2 text-xs text-ink-3">المسافات بتتحسب من الركن العلوي الأيسر لخط القص (من ورا الجراب).</p>
          </div>
        </div>

        <div className="hidden sm:block">
          <svg viewBox={`-2 -2 ${vw + 4} ${vh + 4}`} className="mx-auto h-auto w-full max-w-[150px]" aria-label="معاينة">
            <rect
              x="0"
              y="0"
              width={vw}
              height={vh}
              rx={Math.min(t.cornerRadiusMm, vw / 2)}
              fill="#fff"
              stroke="#EC008C"
              strokeWidth="0.6"
            />
            {t.cutouts.map((c) =>
              c.shape === 'circle' ? (
                <ellipse
                  key={c.id}
                  cx={c.xMm + c.widthMm / 2}
                  cy={c.yMm + c.heightMm / 2}
                  rx={c.widthMm / 2}
                  ry={c.heightMm / 2}
                  fill="rgba(214,69,31,.25)"
                  stroke="#D6451F"
                  strokeWidth="0.5"
                />
              ) : (
                <rect
                  key={c.id}
                  x={c.xMm}
                  y={c.yMm}
                  width={c.widthMm}
                  height={c.heightMm}
                  rx={c.radiusMm ?? 0}
                  fill="rgba(214,69,31,.25)"
                  stroke="#D6451F"
                  strokeWidth="0.5"
                />
              )
            )}
          </svg>
        </div>
      </div>
    </Modal>
  );
}
