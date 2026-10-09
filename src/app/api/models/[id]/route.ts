import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DeviceModel } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const model = db.getModel(id);
    if (!model) {
      return NextResponse.json({ success: false, error: 'الموديل غير موجود' }, { status: 404 });
    }
    return NextResponse.json({ success: true, model });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body: DeviceModel = await req.json();
    body.id = id;
    const saved = db.saveModel(body);
    return NextResponse.json({ success: true, model: saved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = db.deleteModel(id);
    return NextResponse.json({ success: deleted });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
