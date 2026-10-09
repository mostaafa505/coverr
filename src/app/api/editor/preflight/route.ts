import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { runPreflightCheck } from '@/lib/preflight';
import { DesignData } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { modelId, designData } = (await req.json()) as {
      modelId: string;
      designData: DesignData;
    };

    if (!modelId || !designData) {
      return NextResponse.json({ success: false, error: 'بيانات غير مكتملة' }, { status: 400 });
    }

    const model = db.getModel(modelId);
    if (!model) {
      return NextResponse.json({ success: false, error: 'الموديل غير موجود' }, { status: 404 });
    }

    const report = runPreflightCheck(designData, model);
    return NextResponse.json({ success: true, report });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
