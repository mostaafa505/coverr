import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { generateGangSheet } from '@/lib/printEngine';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderIds, sheetSize = 'A3' } = body as { orderIds?: string[]; sheetSize?: 'A3' | 'A4' };

    let orders = db.getOrders();
    if (orderIds && orderIds.length > 0) {
      orders = orders.filter((o) => orderIds.includes(o.id));
    } else {
      // Default: take up to 8 recent orders that have print png
      orders = orders.filter((o) => !!o.printPngUrl).slice(0, 8);
    }

    if (!orders.length) {
      return NextResponse.json({ success: false, error: 'لا توجد طلبات متوفرة للتجميع' }, { status: 400 });
    }

    const items: Array<{ orderId: string; modelName: string; pngBuffer: Buffer; widthMm: number; heightMm: number }> = [];

    for (const ord of orders) {
      if (!ord.printPngUrl) continue;
      const cleanPath = ord.printPngUrl.replace(/^[/\\]+/, '');
      const filePath = path.resolve(process.cwd(), 'public', cleanPath);
      if (!fs.existsSync(filePath)) continue;

      const model = db.getModel(ord.modelId);
      const widthMm = (model?.template?.widthMm || 75) + 6; // with bleed
      const heightMm = (model?.template?.heightMm || 160) + 6;

      items.push({
        orderId: ord.id,
        modelName: ord.modelName,
        pngBuffer: fs.readFileSync(filePath),
        widthMm,
        heightMm,
      });
    }

    if (!items.length) {
      return NextResponse.json({ success: false, error: 'لم يتم العثور على ملفات PNG الصالحة للطلبات' }, { status: 400 });
    }

    const { pdfBuffer, pngBuffer, itemsPlaced } = await generateGangSheet(items, sheetSize);

    const gangId = `GANG-${Date.now().toString().slice(-6)}`;
    const outputDir = path.join(process.cwd(), 'public', 'uploads', 'gang-sheets');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const pdfFileName = `${gangId}_${sheetSize}_SHEET.pdf`;
    const pngFileName = `${gangId}_${sheetSize}_SHEET.png`;
    fs.writeFileSync(path.join(outputDir, pdfFileName), pdfBuffer);
    fs.writeFileSync(path.join(outputDir, pngFileName), pngBuffer);

    return NextResponse.json({
      success: true,
      gangId,
      itemsPlaced,
      sheetSize,
      pdfUrl: `/uploads/gang-sheets/${pdfFileName}`,
      pngUrl: `/uploads/gang-sheets/${pngFileName}`,
      downloadPdfUrl: `/api/download?file=/uploads/gang-sheets/${pdfFileName}`,
      downloadPngUrl: `/api/download?file=/uploads/gang-sheets/${pngFileName}`,
    });
  } catch (err: any) {
    console.error('Gang sheet error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
