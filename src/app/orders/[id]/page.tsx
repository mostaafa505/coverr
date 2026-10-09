import { notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import {
  CheckCircle2,
  Download,
  Printer,
  FileText,
  FileCode,
  Image as ImageIcon,
  Smartphone,
  Ruler,
  Calendar,
  User,
  Phone,
  MapPin,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = db.getOrder(id);

  if (!order) {
    notFound();
  }

  const model = db.getModel(order.modelId);
  const template = model?.template;

  return (
    <div className="flex-1 bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Success Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center relative overflow-hidden">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1 block">
            تم اعتماد التصميم وتوليد ملفات الطباعة بنجاح
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-2">
            طلب رقم: <span className="font-mono text-sky-600">{order.orderNumber}</span>
          </h1>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            تم فحص التصميم بمحرك الـ Preflight وتوليد ملف PDF/X-4 عالي الدقة (300 DPI) مع علامات القص وطبقة القص
            المنفصلة (CUT).
          </p>
        </div>

        {/* Print Files Download Section (The most important part!) */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">ملفات الطباعة الجاهزة للإنتاج 100%</h2>
              <p className="text-xs text-slate-400">
                جاهزة للإرسال إلى ماكينة الطباعة (UV / Sublimation) وماكينة قص الليزر (Laser / Plotter)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. PDF/X Print File */}
            <a
              href={order.printPdfUrl || '#'}
              download
              className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-2xl p-5 flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center mb-3">
                  <FileText className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-white mb-1">ملف PDF/X-4 للطباعة</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  300 DPI، ألوان CMYK، مقاس بالملليمتر + 3mm Bleed، مع علامات القص (Crop Marks) وطبقة CUT.
                </p>
              </div>
              <span className="w-full py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow">
                <Download className="w-3.5 h-3.5" />
                <span>تحميل PDF الطباعة</span>
              </span>
            </a>

            {/* 2. High-Res PNG File */}
            <a
              href={order.printPngUrl || '#'}
              download
              className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-2xl p-5 flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center mb-3">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-white mb-1">نسخة PNG بدقة 300 DPI</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  صورة عالية الدقة بالمقاس الفعلي بالبكسل مع كثافة 300 DPI كبديل مباشر لماكينات RIP.
                </p>
              </div>
              <span className="w-full py-2 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow">
                <Download className="w-3.5 h-3.5" />
                <span>تحميل PNG (300 DPI)</span>
              </span>
            </a>

            {/* 3. Laser Cut SVG File */}
            <a
              href={order.cutSvgUrl || '#'}
              download
              className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-2xl p-5 flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                  <FileCode className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-white mb-1">مسار القص (CUT Vector)</h3>
                <p className="text-xs text-slate-300 leading-relaxed mb-4">
                  ملف SVG بمسارات متجهة (Vector paths) بأبعاد ملليمتر حقيقية لماكينات الليزر والكاتر بلوتر.
                </p>
              </div>
              <span className="w-full py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow">
                <Download className="w-3.5 h-3.5" />
                <span>تحميل داي لاين CUT</span>
              </span>
            </a>
          </div>
        </div>

        {/* Technical Job Ticket & Order Specs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Device & Print Specifications */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
            <h3 className="font-bold text-base text-slate-900 mb-4 flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-sky-600" />
              <span>مواصفات الهاتف وقالب الطباعة:</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-500">اسم الموديل:</span>
                <span className="font-bold text-slate-800">{order.modelName}</span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-500">الماركة:</span>
                <span className="font-bold text-slate-800">{order.brandName}</span>
              </div>
              {template && (
                <>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <span className="text-slate-500">مقاس القص النهائي (Trim):</span>
                    <span className="font-mono font-bold text-slate-800">
                      {template.widthMm} × {template.heightMm} مم
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <span className="text-slate-500">مقاس الطباعة بالـ Bleed:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {template.widthMm + (template.bleedMm || 3) * 2} ×{' '}
                      {template.heightMm + (template.bleedMm || 3) * 2} مم
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <span className="text-slate-500">تقويس الأركان (Radius):</span>
                    <span className="font-mono font-bold text-slate-800">{template.cornerRadiusMm} مم</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <span className="text-slate-500">عدد فتحات الكاميرا والمستشعرات:</span>
                    <span className="font-bold text-slate-800">{template.cutouts.length} فتحات</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Customer & Preflight Verification */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-base text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" />
                <span>بيانات العميل والطلب:</span>
              </h3>

              <div className="space-y-3 text-xs mb-6">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                  <span className="text-slate-500">اسم العميل:</span>
                  <span className="font-bold text-slate-800">{order.customerName}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                  <span className="text-slate-500">رقم الهاتف:</span>
                  <span className="font-mono font-bold text-slate-800">{order.customerPhone}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                  <span className="text-slate-500">المدينة:</span>
                  <span className="font-bold text-slate-800">{order.customerCity || 'غير محدد'}</span>
                </div>
                {order.customerNotes && (
                  <div className="p-2.5 rounded-xl bg-slate-50">
                    <span className="text-slate-500 block mb-1">ملاحظات العميل:</span>
                    <span className="font-medium text-slate-700">{order.customerNotes}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Preflight Badge */}
            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                اجتاز فحص ما قبل الطباعة (Preflight Certified) • الدقة: 300 DPI • أبعاد معتمدة
              </span>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center pt-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-sky-600 hover:text-sky-700"
          >
            <span>تصميم جراب آخر</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
