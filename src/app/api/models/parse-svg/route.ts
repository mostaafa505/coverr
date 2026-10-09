import { NextRequest, NextResponse } from 'next/server';
import { parseSvgDieline } from '@/lib/svgParser';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let svgContent = '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ success: false, error: 'لم يتم إرسال ملف' }, { status: 400 });
      }
      svgContent = await file.text();
    } else {
      const body = await req.json();
      svgContent = body.svg || body.content || '';
    }

    if (!svgContent) {
      return NextResponse.json({ success: false, error: 'محتوى SVG فارغ' }, { status: 400 });
    }

    const parseResult = parseSvgDieline(svgContent);
    return NextResponse.json(parseResult);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
