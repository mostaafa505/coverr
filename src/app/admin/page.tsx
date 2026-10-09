'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Smartphone,
  Plus,
  Upload,
  FileCode,
  Download,
  Trash2,
  Edit3,
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer,
  Ruler,
  Layers,
  Camera,
  ExternalLink,
  RefreshCw,
  Eye,
  Sliders,
  Lock,
  Unlock,
  ShieldCheck,
  ChevronLeft,
} from 'lucide-react';
import { DeviceModel, Brand, Order, PrintTemplate, Cutout, CutoutType, CutoutShape } from '@/types';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'models' | 'import-svg' | 'bulk-data' | 'orders' | 'brands'>('models');
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterBrand, setFilterBrand] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Model Modal (Add / Edit)
  const [modelModalOpen, setModelModalOpen] = useState<boolean>(false);
  const [editingModel, setEditingModel] = useState<DeviceModel | null>(null);

  // SVG Die-line parser state
  const [svgFile, setSvgFile] = useState<File | null>(null);
  const [svgParsing, setSvgParsing] = useState<boolean>(false);
  const [parsedTemplate, setParsedTemplate] = useState<PrintTemplate | null>(null);
  const [svgWarnings, setSvgWarnings] = useState<string[]>([]);
  const [targetModelForSvg, setTargetModelForSvg] = useState<string>('');

  // Bulk CSV/JSON import state
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkStatus, setBulkStatus] = useState<string | null>(null);

  // Fetch all initial data
  const fetchData = async () => {
    setLoading(true);
    try {
      const [modelsRes, brandsRes, ordersRes] = await Promise.all([
        fetch('/api/models'),
        fetch('/api/brands'),
        fetch('/api/orders'),
      ]);

      const [modelsData, brandsData, ordersData] = await Promise.all([
        modelsRes.json(),
        brandsRes.json(),
        ordersRes.json(),
      ]);

      if (modelsData.success) setModels(modelsData.models);
      if (brandsData.success) setBrands(brandsData.brands);
      if (ordersData.success) setOrders(ordersData.orders);
    } catch (err) {
      console.error('Fetch admin data error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter models
  const filteredModels = models.filter((m) => {
    const brandMatch = filterBrand === 'all' || m.brandId === filterBrand;
    const statusMatch = filterStatus === 'all' || m.status === filterStatus;
    const searchMatch =
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.aliases?.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));
    return brandMatch && statusMatch && searchMatch;
  });

  // Open modal to add new model
  const handleAddNewModel = () => {
    setEditingModel({
      id: `model-${Date.now()}`,
      brandId: brands[0]?.id || 'samsung',
      name: '',
      releaseYear: 2024,
      aliases: [],
      status: 'needs_template',
      template: {
        widthMm: 75.0,
        heightMm: 160.0,
        cornerRadiusMm: 6.0,
        bleedMm: 3.0,
        safeMarginMm: 3.0,
        cutouts: [],
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setModelModalOpen(true);
  };

  // Open modal to edit existing model
  const handleEditModel = (model: DeviceModel) => {
    // Clone
    setEditingModel(JSON.parse(JSON.stringify(model)));
    setModelModalOpen(true);
  };

  // Delete model
  const handleDeleteModel = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الموديل وقالب الطباعة الخاص به؟')) return;
    try {
      const res = await fetch(`/api/models/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setModels((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save model from modal
  const handleSaveModel = async () => {
    if (!editingModel || !editingModel.name) {
      alert('يرجى إدخال اسم الموديل');
      return;
    }

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingModel),
      });

      const data = await res.json();
      if (data.success) {
        setModelModalOpen(false);
        fetchData();
      } else {
        alert(data.error || 'حدث خطأ أثناء الحفظ');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Parse SVG Die-line
  const handleUploadSvgDieline = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSvgFile(file);
    setSvgParsing(true);
    setSvgWarnings([]);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/models/parse-svg', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.success && data.template) {
        setParsedTemplate(data.template);
        setSvgWarnings(data.warnings || []);
      } else {
        alert(data.warnings?.[0] || 'فشل استخراج البيانات من ملف SVG');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء معالجة الملف');
    } finally {
      setSvgParsing(false);
    }
  };

  // Apply parsed SVG template to a target model
  const handleApplySvgToModel = async () => {
    if (!parsedTemplate || !targetModelForSvg) {
      alert('يرجى اختيار الموديل المستهدف لحفظ القالب فيه');
      return;
    }

    const target = models.find((m) => m.id === targetModelForSvg);
    if (!target) return;

    const updatedModel: DeviceModel = {
      ...target,
      status: 'active', // Now ready for public use!
      template: parsedTemplate,
    };

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedModel),
      });

      const data = await res.json();
      if (data.success) {
        alert(`تم تطبيق القالب بنجاح على موديل ${target.name}، وأصبح متاحاً للعملاء الآن!`);
        setParsedTemplate(null);
        setSvgFile(null);
        fetchData();
        setActiveTab('models');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Bulk import
  const handleBulkImport = async () => {
    if (!bulkFile) return;
    setBulkStatus('جاري الاستيراد والمعالجة...');

    try {
      const isJson = bulkFile.name.endsWith('.json');
      const text = await bulkFile.text();

      const res = await fetch('/api/models/import', {
        method: 'POST',
        headers: {
          'Content-Type': isJson ? 'application/json' : 'text/csv',
        },
        body: text,
      });

      const data = await res.json();
      if (data.success) {
        setBulkStatus(data.message);
        fetchData();
      } else {
        setBulkStatus(`فشل الاستيراد: ${data.error}`);
      }
    } catch (err: any) {
      setBulkStatus(`خطأ: ${err.message}`);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Dashboard Top Header */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <h1 className="text-2xl font-extrabold text-slate-900">لوحة تحكم القوالب والإنتاج</h1>
            </div>
            <p className="text-xs text-slate-500">
              إدارة أبعاد الموديلات بالملليمتر، استخراج داي لاين SVG، ومتابعة مخرجات الطباعة 300 DPI
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleAddNewModel}
              className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة موديل يدوي</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto gap-2 text-sm font-semibold pb-1">
          <button
            onClick={() => setActiveTab('models')}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors ${
              activeTab === 'models' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>الموديلات ({models.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('import-svg')}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors ${
              activeTab === 'import-svg' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <FileCode className="w-4 h-4" />
            <span>استخراج الداي لاين (SVG Die-line)</span>
          </button>
          <button
            onClick={() => setActiveTab('bulk-data')}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors ${
              activeTab === 'bulk-data' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>استيراد جماعي (CSV / JSON)</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors ${
              activeTab === 'orders' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>الطلبات والطباعة ({orders.length})</span>
          </button>
        </div>

        {/* TAB 1: Models Management */}
        {activeTab === 'models' && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                <input
                  type="text"
                  placeholder="بحث باسم الموديل أو الكود البديل (مثل 2312DRA50C)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>

              {/* Brand filter */}
              <select
                value={filterBrand}
                onChange={(e) => setFilterBrand(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700"
              >
                <option value="all">كل الماركات</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nameAr} ({b.name})
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700"
              >
                <option value="all">كل الحالات</option>
                <option value="active">قالب متاح ومعتمد (جاهز للطباعة)</option>
                <option value="needs_template">يحتاج قالب (غير متاح للعميل)</option>
              </select>
            </div>

            {/* Models Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">الموديل والكود</th>
                      <th className="py-3.5 px-4">الماركة</th>
                      <th className="py-3.5 px-4">أبعاد مساحة الطباعة</th>
                      <th className="py-3.5 px-4">الـ Bleed والأمان</th>
                      <th className="py-3.5 px-4">الفتحات (Cutouts)</th>
                      <th className="py-3.5 px-4">حالة القالب</th>
                      <th className="py-3.5 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredModels.map((m) => {
                      const brand = brands.find((b) => b.id === m.brandId);
                      const t = m.template;
                      const isReady = m.status === 'active' && t && t.widthMm > 0;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-sm">{m.name}</div>
                            {m.aliases && m.aliases.length > 0 && (
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {m.aliases.join(' • ')}
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-slate-700">{brand?.nameAr || m.brandId}</span>
                            <span className="text-[10px] text-slate-400 block">{m.releaseYear}</span>
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            {t ? (
                              <span className="font-semibold text-slate-800">
                                {t.widthMm} × {t.heightMm} مم
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">غير محدد</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono">
                            {t ? (
                              <span>
                                Bleed: +{t.bleedMm || 3} مم | Safe: {t.safeMarginMm || 3} مم
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {t?.cutouts?.length ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 font-semibold text-[11px]">
                                <Camera className="w-3 h-3" />
                                <span>{t.cutouts.length} فتحات</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">لا توجد فتحات</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {isReady ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>معتمد ومتاح للعملاء</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-semibold text-[11px]">
                                <Lock className="w-3.5 h-3.5" />
                                <span>يحتاج قالب (مخفي عن العميل)</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-1.5">
                              {isReady && (
                                <Link
                                  href={`/editor/${m.id}`}
                                  target="_blank"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50"
                                  title="معاينة في المحرر"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </Link>
                              )}
                              <button
                                onClick={() => handleEditModel(m)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                title="تعديل المقاسات"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteModel(m.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SVG Die-line Extractor */}
        {activeTab === 'import-svg' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-sky-600" />
                <h3 className="font-extrabold text-base text-slate-900">رفع داي لاين SVG من المورد</h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                يقوم النظام بتحليل ملف SVG المستلم من المصنع، واستخراج أبعاد الإطار الخارجي والفتحات (الكاميرا،
                الفلاش، البصمة) بالملليمتر تلقائياً لمعايرتها وحفظها.
              </p>

              <label className="border-2 border-dashed border-sky-400 hover:border-sky-600 bg-sky-50/50 hover:bg-sky-50 p-8 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer text-center block transition-all">
                <Upload className="w-8 h-8 text-sky-600" />
                <div>
                  <span className="font-bold text-sm text-sky-900 block">اختر ملف SVG الداي لاين</span>
                  <span className="text-xs text-slate-500">.svg أو ملفات الفكتور المعيارية</span>
                </div>
                <input type="file" accept=".svg,image/svg+xml" onChange={handleUploadSvgDieline} className="hidden" />
              </label>

              {svgParsing && (
                <div className="p-3 bg-sky-50 rounded-xl text-xs text-sky-700 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-sky-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري تحليل المسارات والأبعاد بالملليمتر...</span>
                </div>
              )}

              {svgWarnings.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 space-y-1">
                  <span className="font-bold block">ملاحظات المعايرة:</span>
                  {svgWarnings.map((w, idx) => (
                    <p key={idx}>• {w}</p>
                  ))}
                </div>
              )}

              {parsedTemplate && (
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  <h4 className="font-bold text-sm text-slate-900">ربط القالب المستخرج بموديل:</h4>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">اختر الموديل:</label>
                    <select
                      value={targetModelForSvg}
                      onChange={(e) => setTargetModelForSvg(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                    >
                      <option value="">-- اختر الموديل --</option>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.status === 'active' ? 'قالب موجود' : 'يحتاج قالب'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleApplySvgToModel}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>حفظ القالب واعتماد الموديل كـ "متاح للطباعة"</span>
                  </button>
                </div>
              )}
            </div>

            {/* SVG Die-line Live Preview */}
            <div className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-sm text-white mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-sky-400" />
                  <span>معاينة الداي لاين المستخرج (بالملليمتر)</span>
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  شبكة أبعاد حقيقية لمطابقة الفتحات مع مواصفات الجراب الفعلي
                </p>

                {parsedTemplate ? (
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex items-center justify-center min-h-[300px]">
                    <div
                      className="border-2 border-red-500 relative bg-slate-900 shadow-2xl"
                      style={{
                        width: `${parsedTemplate.widthMm * 2.2}px`,
                        height: `${parsedTemplate.heightMm * 2.2}px`,
                        borderRadius: `${(parsedTemplate.cornerRadiusMm || 6) * 2.2}px`,
                      }}
                    >
                      <span className="absolute top-1 left-1 text-[9px] font-mono text-red-400">
                        {parsedTemplate.widthMm} × {parsedTemplate.heightMm} mm
                      </span>

                      {parsedTemplate.cutouts.map((c, i) => (
                        <div
                          key={i}
                          style={{
                            left: `${c.xMm * 2.2}px`,
                            top: `${c.yMm * 2.2}px`,
                            width: `${c.widthMm * 2.2}px`,
                            height: `${c.heightMm * 2.2}px`,
                            borderRadius: c.shape === 'circle' ? '9999px' : `${(c.radiusMm || 0) * 2.2}px`,
                          }}
                          className="absolute border border-yellow-400 bg-yellow-400/20 flex items-center justify-center text-[8px] text-yellow-300 font-mono"
                        >
                          {c.type}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-800 rounded-2xl min-h-[300px] flex items-center justify-center text-xs text-slate-500">
                    ارفع ملف SVG لعرض الأبعاد والفتحات هنا مباشرة.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Bulk CSV / JSON Import */}
        {activeTab === 'bulk-data' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6 max-w-2xl">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 mb-1">استيراد مجموعة موديلات دفعة واحدة</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                ارفع ملف CSV أو JSON يحتوي على قائمة الموديلات ومقاساتها. أي موديل بدون مقاسات سيتم تسجيله تلقائياً
                بحالة "يحتاج قالب" لضمان عدم ظهوره للمستخدم.
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs font-mono text-slate-700 space-y-2">
              <div className="flex justify-between items-center text-slate-500 font-sans font-bold">
                <span>نموذج رأس ملف CSV المطلوب:</span>
                <span className="text-[11px] text-sky-600 font-mono">utf-8</span>
              </div>
              <p className="overflow-x-auto p-2 bg-white rounded border border-slate-200">
                name,brandId,releaseYear,aliases,widthMm,heightMm,cornerRadiusMm,bleedMm,safeMarginMm
              </p>
              <p className="text-slate-500 text-[11px] font-sans">
                مثال: Redmi Note 13,xiaomi,2024,2312DRA50C;Note 13 4G,75.6,162.2,6.5,3,3
              </p>
            </div>

            <div className="space-y-3">
              <input
                type="file"
                accept=".csv, .json, text/csv, application/json"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 cursor-pointer"
              />

              <button
                onClick={handleBulkImport}
                disabled={!bulkFile}
                className="py-2.5 px-6 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-200 text-white font-bold text-xs flex items-center gap-2 shadow"
              >
                <Upload className="w-4 h-4" />
                <span>بدء الاستيراد للكتالوج</span>
              </button>

              {bulkStatus && (
                <div className="p-3 bg-slate-100 rounded-xl text-xs font-semibold text-slate-800">
                  {bulkStatus}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Orders Management */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">سجل طلبات الطباعة والإنتاج</h3>
                <p className="text-xs text-slate-500">
                  جميع التصاميم المستلمة مرفقة مع ملفات PDF/X-4 وPNG 300 DPI وCUT Vector
                </p>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="text-center py-16 text-slate-400 text-xs">
                لا توجد طلبات جديدة حتى الآن.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3.5 px-4">رقم الطلب والتاريخ</th>
                      <th className="py-3.5 px-4">العميل</th>
                      <th className="py-3.5 px-4">الموديل والمقاس</th>
                      <th className="py-3.5 px-4">فحص الـ Preflight</th>
                      <th className="py-3.5 px-4">مخرجات الطباعة (تحميل مباشر)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <span className="font-mono font-bold text-slate-900 block">{o.orderNumber}</span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(o.createdAt).toLocaleString('ar-EG')}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 block">{o.customerName}</span>
                          <span className="text-slate-500 font-mono text-[11px]">{o.customerPhone}</span>
                          {o.customerCity && (
                            <span className="text-slate-400 text-[10px] block">{o.customerCity}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800 block">{o.modelName}</span>
                          <span className="text-slate-500 text-[11px]">{o.brandName}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold text-[11px]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>300 DPI معتمد</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            {o.printPdfUrl && (
                              <a
                                href={o.printPdfUrl}
                                download
                                className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 font-bold text-[11px] flex items-center gap-1 border border-red-200"
                              >
                                <Download className="w-3 h-3" />
                                <span>PDF/X</span>
                              </a>
                            )}
                            {o.printPngUrl && (
                              <a
                                href={o.printPngUrl}
                                download
                                className="px-2.5 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-[11px] flex items-center gap-1 border border-sky-200"
                              >
                                <Download className="w-3 h-3" />
                                <span>PNG 300DPI</span>
                              </a>
                            )}
                            {o.cutSvgUrl && (
                              <a
                                href={o.cutSvgUrl}
                                download
                                className="px-2.5 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold text-[11px] flex items-center gap-1 border border-purple-200"
                              >
                                <Download className="w-3 h-3" />
                                <span>CUT SVG</span>
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Manual Model Add/Edit Modal */}
      {modelModalOpen && editingModel && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl text-right max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-extrabold text-lg text-slate-900">
                {editingModel.name ? `تعديل مقاسات: ${editingModel.name}` : 'إضافة موديل جديد بمقاسات دقيقة'}
              </h3>
              <button onClick={() => setModelModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">اسم الموديل:</label>
                  <input
                    type="text"
                    value={editingModel.name}
                    onChange={(e) => setEditingModel({ ...editingModel, name: e.target.value })}
                    placeholder="مثال: Redmi Note 13"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">الماركة (Brand):</label>
                  <select
                    value={editingModel.brandId}
                    onChange={(e) => setEditingModel({ ...editingModel, brandId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nameAr} ({b.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">
                    الأسماء والأكواد البديلة (مفصولة بفاصلة):
                  </label>
                  <input
                    type="text"
                    value={editingModel.aliases?.join(', ') || ''}
                    onChange={(e) =>
                      setEditingModel({
                        ...editingModel,
                        aliases: e.target.value.split(',').map((a) => a.trim()).filter(Boolean),
                      })
                    }
                    placeholder="2312DRA50C, Note 13 4G"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 mb-1 block">سنة الإصدار:</label>
                  <input
                    type="number"
                    value={editingModel.releaseYear}
                    onChange={(e) => setEditingModel({ ...editingModel, releaseYear: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  />
                </div>
              </div>

              {/* Millimeter Measurements Section */}
              <div className="p-4 bg-sky-50/50 rounded-2xl border border-sky-100 space-y-3">
                <h4 className="font-bold text-xs text-sky-900 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5" />
                  <span>المقاسات الهندسية الدقيقة بالملليمتر (من المورد):</span>
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-600 mb-1 block">العرض (mm):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editingModel.template?.widthMm || 0}
                      onChange={(e) =>
                        setEditingModel({
                          ...editingModel,
                          template: {
                            ...(editingModel.template || {
                              cornerRadiusMm: 6,
                              bleedMm: 3,
                              safeMarginMm: 3,
                              cutouts: [],
                            }),
                            widthMm: parseFloat(e.target.value) || 0,
                            heightMm: editingModel.template?.heightMm || 0,
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 mb-1 block">الارتفاع (mm):</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editingModel.template?.heightMm || 0}
                      onChange={(e) =>
                        setEditingModel({
                          ...editingModel,
                          template: {
                            ...(editingModel.template || {
                              cornerRadiusMm: 6,
                              bleedMm: 3,
                              safeMarginMm: 3,
                              cutouts: [],
                            }),
                            heightMm: parseFloat(e.target.value) || 0,
                            widthMm: editingModel.template?.widthMm || 0,
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 mb-1 block">تقويس الأركان (mm):</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editingModel.template?.cornerRadiusMm || 6}
                      onChange={(e) =>
                        setEditingModel({
                          ...editingModel,
                          template: {
                            ...editingModel.template!,
                            cornerRadiusMm: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600 mb-1 block">الهامش Bleed (mm):</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editingModel.template?.bleedMm || 3}
                      onChange={(e) =>
                        setEditingModel({
                          ...editingModel,
                          template: {
                            ...editingModel.template!,
                            bleedMm: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 mb-1 block">حالة القالب:</label>
                <select
                  value={editingModel.status}
                  onChange={(e) => setEditingModel({ ...editingModel, status: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold"
                >
                  <option value="active">متاح ونشط للعملاء (القالب معتمد)</option>
                  <option value="needs_template">غير متاح (يحتاج قالب - مخفي عن العملاء)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 mt-6">
              <button
                onClick={() => setModelModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveModel}
                className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow"
              >
                حفظ التعديلات
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
