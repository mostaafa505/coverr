import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generatePrintFiles } from '@/lib/printEngine';
import { Order, DesignData } from '@/types';

export async function GET() {
  try {
    const orders = db.getOrders();
    return NextResponse.json({ success: true, orders, count: orders.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      customerName,
      customerPhone,
      customerCity,
      customerNotes,
      modelId,
      designData,
      previewDataUrl,
      forceExport,
      printOptions,
    } = body as {
      customerName?: string;
      customerPhone?: string;
      customerCity?: string;
      customerNotes?: string;
      modelId: string;
      designData: DesignData;
      previewDataUrl?: string;
      forceExport?: boolean;
      printOptions?: any;
    };

    const effectiveCustomerName = customerName || 'الطباعة المباشرة / المشغل';
    const effectiveCustomerPhone = customerPhone || 'الإنتاج الداخلي';

    if (!modelId || !designData) {
      return NextResponse.json(
        { success: false, error: 'الموديل وبيانات التصميم حقول مطلوبة' },
        { status: 400 }
      );
    }

    const model = db.getModel(modelId);
    if (!model) {
      return NextResponse.json({ success: false, error: 'موديل الهاتف المحدد غير موجود' }, { status: 404 });
    }

    if (!model.template) {
      return NextResponse.json(
        { success: false, error: 'هذا الموديل لا يملك قالب طباعة معتمد، لا يمكن إتمام الطباعة.' },
        { status: 400 }
      );
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const brand = db.getBrand(model.brandId);

    // Call high-precision Print Engine with workshop options
    const printResult = await generatePrintFiles(
      orderId,
      model,
      designData,
      previewDataUrl,
      forceExport !== false,
      printOptions
    );

    if (!printResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: printResult.error,
          errorAr: printResult.errorAr,
          preflightReport: printResult.preflightReport,
        },
        { status: 422 }
      );
    }

    const newOrder: Order = {
      id: orderId,
      orderNumber: orderId,
      customerName: effectiveCustomerName,
      customerPhone: effectiveCustomerPhone,
      customerCity: customerCity || '',
      customerNotes: customerNotes || '',
      modelId: model.id,
      modelName: model.name,
      brandName: brand?.nameAr || brand?.name || model.brandId,
      previewUrl: previewDataUrl || '',
      printPdfUrl: printResult.files?.pdfUrl,
      proofPdfUrl: printResult.files?.proofPdfUrl,
      printPngUrl: printResult.files?.pngUrl,
      cutSvgUrl: printResult.files?.cutSvgUrl,
      whiteUnderbasePngUrl: printResult.files?.whiteUnderbaseUrl,
      technology: printOptions?.technology || 'sublimation',
      caseType: printOptions?.caseType || '2d_flat',
      designData,
      preflightReport: printResult.preflightReport,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    db.saveOrder(newOrder);

    return NextResponse.json({
      success: true,
      order: newOrder,
      files: printResult.files,
      message: 'تم إنشاء الطلب وتوليد ملفات الطباعة بدقة 300 DPI بنجاح',
    });
  } catch (err: any) {
    console.error('Order creation error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
