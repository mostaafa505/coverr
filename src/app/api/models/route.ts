import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DeviceModel } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get('brandId') || undefined;
    const os = (searchParams.get('os') as any) || undefined;
    const search = searchParams.get('search') || undefined;
    const onlyActive = searchParams.get('onlyActive') === 'true';

    const models = db.getModels({
      brandId,
      os,
      search,
      onlyActiveForPublic: onlyActive,
    });

    return NextResponse.json({ success: true, models, count: models.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: DeviceModel = await req.json();

    if (!body.id || !body.name || !body.brandId) {
      return NextResponse.json(
        { success: false, error: 'الاسم والموديل والماركة حقول إلزامية' },
        { status: 400 }
      );
    }

    const saved = db.saveModel(body);
    return NextResponse.json({ success: true, model: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
