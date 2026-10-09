import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const brands = db.getBrands();
    return NextResponse.json({ success: true, brands });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id || !body.name) {
      return NextResponse.json({ success: false, error: 'المعرف والاسم مطلوبان' }, { status: 400 });
    }
    const saved = db.saveBrand(body);
    return NextResponse.json({ success: true, brand: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
