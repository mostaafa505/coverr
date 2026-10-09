import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DeviceModel } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let modelsToImport: DeviceModel[] = [];

    if (contentType.includes('application/json')) {
      const body = await req.json();
      if (Array.isArray(body)) {
        modelsToImport = body;
      } else if (body.models && Array.isArray(body.models)) {
        modelsToImport = body.models;
      } else {
        return NextResponse.json({ success: false, error: 'تنسيق JSON غير صالح، المتوقع مصفوفة موديلات' }, { status: 400 });
      }
    } else {
      // Handle CSV text
      const csvText = await req.text();
      const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
      if (lines.length < 2) {
        return NextResponse.json({ success: false, error: 'ملف CSV فارغ أو لا يحتوي على بيانات' }, { status: 400 });
      }

      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map((p) => p.trim());
        if (parts.length < 2) continue;

        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = parts[idx] || '';
        });

        const name = row['name'] || row['اسم_الموديل'] || `Model-${i}`;
        const brandId = row['brandid'] || row['brand'] || row['الماركة'] || 'other';
        const id = `${brandId}-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const aliases = (row['aliases'] || row['أسماء_بديلة'] || '').split(';').map((a) => a.trim()).filter(Boolean);
        const releaseYear = parseInt(row['releaseyear'] || row['year'] || '2024', 10);

        const widthMm = parseFloat(row['widthmm'] || row['العرض'] || '0');
        const heightMm = parseFloat(row['heightmm'] || row['الارتفاع'] || '0');
        const cornerRadiusMm = parseFloat(row['cornerradiusmm'] || row['التقويس'] || '6');
        const bleedMm = parseFloat(row['bleedmm'] || '3');
        const safeMarginMm = parseFloat(row['safemarginmm'] || '3');

        const hasTemplate = widthMm > 0 && heightMm > 0;
        const status = hasTemplate ? 'active' : 'needs_template';

        modelsToImport.push({
          id,
          brandId,
          name,
          releaseYear,
          aliases,
          status,
          template: hasTemplate
            ? {
                widthMm,
                heightMm,
                cornerRadiusMm,
                bleedMm,
                safeMarginMm,
                cutouts: [],
              }
            : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    if (modelsToImport.length === 0) {
      return NextResponse.json({ success: false, error: 'لم يتم العثور على موديلات صالحة للاستيراد' }, { status: 400 });
    }

    const res = db.bulkUpsertModels(modelsToImport);
    return NextResponse.json({
      success: true,
      importedCount: res.count,
      message: `تم استيراد ${res.count} موديل بنجاح`,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
