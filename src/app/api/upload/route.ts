import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ success: false, error: 'لم يتم اختيار ملف' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract image metadata using sharp
    const metadata = await sharp(buffer).metadata();

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'user-assets');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const ext = path.extname(file.name) || '.png';
    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filePath = path.join(uploadsDir, filename);

    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({
      success: true,
      url: `/uploads/user-assets/${filename}`,
      originalWidth: metadata.width || 800,
      originalHeight: metadata.height || 800,
      format: metadata.format,
      density: metadata.density || 72,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
