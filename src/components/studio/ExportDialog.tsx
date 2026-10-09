'use client';

import { AlertTriangle, CheckCircle2, Download, FileArchive, FileImage, FileText, Info, Loader2, Scissors, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExportOptions, PrintTechnology } from '@/types';
import { Modal, Segmented, Toggle, cx } from '@/components/ui/primitives';
import { runPreflight, type Issue } from '@/lib/design/preflight';
import { OPTION_DEFAULTS } from '@/lib/export/defaults';
import type { ExportFile, ExportResult } from '@/lib/export/job';
import { getPref, setPref } from '@/lib/catalog';
import type { useStudio } from './useStudio';

type Studio = ReturnType<typeof useStudio>;

const DEFAULTS: ExportOptions = {
  technology: 'sublimation',
  caseType: 'flat',
  mirror: true,
  cutLineInPdf: false,
  registrationMarks: false,
  whiteInk: false,
  smallFile: false,
  jobName: '',
};

const TECH: { value: PrintTechnology; label: string; hint: string }[] = [
  { value: 'sublimation', label: 'سبلميشن', hint: 'الطباعة على ورق نقل حراري. الصورة بتتقلب تلقائيًا.' },
  { value: 'dtf', label: 'DTF', hint: 'الطباعة على فيلم. الصورة بتتقلب، وبتتجهّز طبقة الحبر الأبيض.' },
  { value: 'uv', label: 'UV', hint: 'الطباعة المباشرة على الجراب. من غير قلب، مع طبقة الحبر الأبيض.' },
];

export default function ExportDialog({
  open,
  studio,
  onClose,
  onShowElement,
}: {
  open: boolean;
  studio: Studio;
  onClose: () => void;
  onShowElement: (id: string) => void;
}) {
  const [opts, setOpts] = useState<ExportOptions>(() => ({ ...DEFAULTS, ...getPref<Partial<ExportOptions>>('export', {}) }));
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);
  const [ack, setAck] = useState(false);
  const urls = useRef<string[]>([]);

  const model = studio.model;
  const report = useMemo(
    () => (model && open ? runPreflight(studio.design, model, studio.bleedMm) : null),
    [studio.design, model, studio.bleedMm, open]
  );

  useEffect(() => {
    if (open) {
      setResult(null);
      setError(null);
      setAck(false);
    } else {
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      urls.current = [];
    }
  }, [open]);

  if (!model || !report) return <Modal open={false} onClose={onClose} title="" children={null} />;

  const set = (p: Partial<ExportOptions>) =>
    setOpts((o) => {
      const n = { ...o, ...p };
      setPref('export', n);
      return n;
    });

  const blocking = report.issues.filter((i) => i.code === 'EMPTY');
  const errors = report.issues.filter((i) => i.level === 'error' && i.code !== 'EMPTY');
  const needsAck = errors.length > 0;

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const { runExport } = await import('@/lib/export/job');
      const res = await runExport(studio.design, model, studio.bleedMm, studio.images, { ...opts, caseType: studio.caseType }, setStep);
      setResult(res);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'حصلت مشكلة غير متوقعة أثناء تجهيز الملفات.');
    } finally {
      setBusy(false);
      setStep('');
    }
  };

  const urlFor = (f: ExportFile) => {
    const u = URL.createObjectURL(f.blob);
    urls.current.push(u);
    return u;
  };

  const download = (f: ExportFile) => {
    const a = document.createElement('a');
    a.href = urlFor(f);
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const openFile = (f: ExportFile) => {
    window.open(urlFor(f), '_blank', 'noopener');
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={result ? 'الملفات جاهزة' : 'تصدير للطباعة'}
      footer={
        result ? (
          <div className="flex gap-2">
            <button type="button" className="btn flex-1" onClick={onClose}>
              رجوع للتصميم
            </button>
            <button type="button" className="btn btn-primary flex-[2]" onClick={() => download(result.zip)}>
              <FileArchive className="h-4 w-4" />
              تحميل كل الملفات (ZIP)
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary w-full !min-h-[46px] text-[15px]"
            disabled={busy || blocking.length > 0 || (needsAck && !ack)}
            onClick={go}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {step || 'بجهّز الملفات…'}
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                جهّز ملفات الطباعة
              </>
            )}
          </button>
        )
      }
    >
      {result ? (
        <Result result={result} onDownload={download} onOpen={openFile} />
      ) : (
        <div>
          <div className="space-y-3 border-b border-line px-4 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-bold">{model.name}</h3>
              <span className="num text-xs text-ink-3">
                {model.template.widthMm} × {model.template.heightMm} mm · bleed {studio.bleedMm}
              </span>
            </div>

            <div>
              <span className="label">نوع الطباعة</span>
              <Segmented
                value={opts.technology}
                options={TECH.map((t) => ({ value: t.value, label: t.label }))}
                onChange={(technology) => set({ technology, ...OPTION_DEFAULTS[technology] })}
              />
              <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{TECH.find((t) => t.value === opts.technology)?.hint}</p>
            </div>

            <div>
              <span className="label">نوع الجراب</span>
              <Segmented
                value={studio.caseType}
                options={[
                  { value: 'flat', label: 'عادي (2D)' },
                  { value: 'wrap3d', label: '3D بيلفّ على الحواف' },
                ]}
                onChange={studio.setCaseType}
              />
              {studio.caseType === 'wrap3d' && (
                <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
                  الهامش بيبقى 12 مم بدل {model.template.bleedMm} مم عشان الصورة تلف حوالين الحواف.
                </p>
              )}
            </div>
          </div>

          <Issues
            report={report.issues}
            onShow={(id) => {
              onShowElement(id);
              onClose();
            }}
          />

          {needsAck && (
            <label className="mx-4 mb-3 flex cursor-pointer items-start gap-2.5 rounded-lg border border-bad/40 bg-bad/5 p-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#C0392B]" checked={ack} onChange={(e) => setAck(e.target.checked)} />
              <span>فاهم إن فيه مشاكل في الجودة وعايز أصدّر برضه.</span>
            </label>
          )}

          <details className="border-t border-line px-4 py-3">
            <summary className="cursor-pointer select-none py-1 text-sm font-semibold">خيارات متقدمة</summary>
            <div className="pt-2">
              <Toggle
                checked={opts.mirror}
                onChange={(mirror) => set({ mirror })}
                label="قلب الصورة (مرآة)"
                hint="شغّلها لو الورق أو الفيلم بيتطبع معكوس ثم يتنقل على الجراب."
              />
              <Toggle
                checked={opts.cutLineInPdf}
                onChange={(cutLineInPdf) => set({ cutLineInPdf })}
                label="خط القص جوه الـ PDF"
                hint="بيتضاف كلون خاص اسمه CutContour في طبقة منفصلة، لماكينات القص اللي بتقرا الخط من الملف."
              />
              <Toggle
                checked={opts.registrationMarks}
                onChange={(registrationMarks) => set({ registrationMarks })}
                label="علامات تسجيل"
                hint="4 نقاط في أركان الورقة لماكينات القص بالكاميرا."
              />
              <Toggle
                checked={opts.whiteInk}
                onChange={(whiteInk) => set({ whiteInk })}
                label="طبقة الحبر الأبيض"
                hint="ملف منفصل بيحدد مكان الحبر الأبيض (UV / DTF)."
              />
              <Toggle
                checked={opts.smallFile}
                onChange={(smallFile) => set({ smallFile })}
                label="ملف أصغر"
                hint="بيستخدم JPEG بجودة عالية (95%). مناسب للإرسال، لكن الأفضل للطباعة تسيبه مقفول."
              />
            </div>
          </details>

          {error && (
            <div className="mx-4 mb-4 flex gap-2 rounded-lg border border-bad/40 bg-bad/5 p-3 text-sm text-bad">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Issues({ report, onShow }: { report: Issue[]; onShow: (id: string) => void }) {
  if (!report.length)
    return (
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3.5 text-sm text-good">
        <CheckCircle2 className="h-[18px] w-[18px] shrink-0" />
        التصميم جاهز، مفيش أي ملاحظات.
      </div>
    );
  return (
    <div className="border-b border-line px-4 py-3">
      <h3 className="mb-2 text-sm font-bold">ملاحظات قبل الطباعة</h3>
      <ul className="space-y-2">
        {report.map((i) => (
          <li
            key={i.id}
            className={cx(
              'flex gap-2.5 rounded-lg border p-2.5 text-sm',
              i.level === 'error' ? 'border-bad/35 bg-bad/5' : i.level === 'warn' ? 'border-warn/35 bg-warn/5' : 'border-line bg-white'
            )}
          >
            {i.level === 'error' ? (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
            ) : i.level === 'warn' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{i.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{i.detail}</p>
              {i.elementId && (
                <button
                  type="button"
                  className="mt-1.5 text-xs font-semibold text-accent underline underline-offset-2"
                  onClick={() => onShow(i.elementId!)}
                >
                  وريني العنصر
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Result({
  result,
  onDownload,
  onOpen,
}: {
  result: ExportResult;
  onDownload: (f: ExportFile) => void;
  onOpen: (f: ExportFile) => void;
}) {
  const s = result.summary;
  const icon = (f: ExportFile) =>
    f.name.endsWith('.pdf') ? (
      <FileText className="h-5 w-5" />
    ) : f.name.endsWith('.svg') ? (
      <Scissors className="h-5 w-5" />
    ) : (
      <FileImage className="h-5 w-5" />
    );
  return (
    <div>
      <div className="flex items-start gap-3 border-b border-line bg-white px-4 py-4">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-good" />
        <div>
          <p className="text-sm font-bold">
            شغل رقم <span className="num">{result.jobId}</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">
            المقاس <span className="num">{s.trim}</span> مم + هامش <span className="num">{s.bleedMm}</span> مم · الصورة{' '}
            <span className="num">{s.pixels}</span> بكسل (300 DPI){s.mirrored ? ' · معكوسة (مرآة)' : ''}
          </p>
          <p className="mt-1 text-xs text-ink-3">اطبعه بمقاسه الحقيقي 100%، وماتختارش "ملاءمة الصفحة".</p>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {result.files.map((f) => (
          <li key={f.name} className="flex items-center gap-3 px-4 py-3">
            <span
              className={cx(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                f.primary ? 'bg-accent-soft text-accent' : 'bg-sunken text-ink-2'
              )}
            >
              {icon(f)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{f.label}</p>
              <p className="truncate text-xs text-ink-3">{f.hint}</p>
              <p className="num truncate text-[11px] text-ink-3">
                {f.name} · {fmt(f.blob.size)}
              </p>
            </div>
            {(f.name.endsWith('.pdf') || f.name.endsWith('.jpg')) && (
              <button type="button" className="btn !min-h-[38px] !px-3 text-[13px]" onClick={() => onOpen(f)}>
                فتح
              </button>
            )}
            <button
              type="button"
              className={cx('btn !min-h-[38px] !px-3 text-[13px]', f.primary && 'btn-primary')}
              onClick={() => onDownload(f)}
              aria-label={`تحميل ${f.label}`}
            >
              <Download className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

const fmt = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
