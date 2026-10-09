import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webp': 'image/webp',
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileParam = searchParams.get('file');
    const orderId = searchParams.get('orderId');
    const typeParam = searchParams.get('type');
    const inline = searchParams.get('inline') === 'true' || searchParams.get('inline') === '1';

    let relativeFilePath = '';

    if (fileParam) {
      let clean = fileParam.trim().replace(/^[/\\]+/, '');
      if (clean.startsWith('public/')) {
        clean = clean.replace(/^public[/\\]+/, '');
      }
      if (!clean.startsWith('uploads/')) {
        clean = `uploads/${clean}`;
      }
      relativeFilePath = clean;
    } else if (orderId) {
      let ordersDir = path.join(process.cwd(), 'public', 'uploads', 'orders', orderId);
      if (!fs.existsSync(ordersDir)) {
        ordersDir = path.join(os.tmpdir(), 'uploads', 'orders', orderId);
      }
      if (!fs.existsSync(ordersDir)) {
        return NextResponse.json({ error: 'Order directory not found' }, { status: 404 });
      }

      const files = fs.readdirSync(ordersDir);
      let targetFile: string | undefined;

      if (typeParam === 'pdf') {
        targetFile = files.find((f) => f.endsWith('.pdf'));
      } else if (typeParam === 'png') {
        targetFile = files.find((f) => f.endsWith('.png'));
      } else if (typeParam === 'svg') {
        targetFile = files.find((f) => f.endsWith('.svg'));
      } else if (typeParam === 'json') {
        targetFile = files.find((f) => f.endsWith('.json'));
      } else {
        targetFile = files.find((f) => f.endsWith('.pdf')) || files[0];
      }

      if (!targetFile) {
        return NextResponse.json({ error: `File of type '${typeParam}' not found for order ${orderId}` }, { status: 404 });
      }

      relativeFilePath = `uploads/orders/${orderId}/${targetFile}`;
    } else {
      return NextResponse.json({ error: 'Missing file or orderId parameter' }, { status: 400 });
    }

    let absoluteFilePath = path.resolve(process.cwd(), 'public', relativeFilePath);

    // If not in public, check tmpdir (Vercel serverless)
    if (!fs.existsSync(absoluteFilePath)) {
      const tmpPath = path.resolve(os.tmpdir(), relativeFilePath);
      if (fs.existsSync(tmpPath)) {
        absoluteFilePath = tmpPath;
      }
    }

    if (!fs.existsSync(absoluteFilePath)) {
      return NextResponse.json({ error: 'File does not exist on disk', path: relativeFilePath }, { status: 404 });
    }

    const stat = fs.statSync(absoluteFilePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Requested path is not a file' }, { status: 400 });
    }

    const ext = path.extname(absoluteFilePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const fileName = path.basename(absoluteFilePath);

    const fileBuffer = fs.readFileSync(absoluteFilePath);
    const dispositionType = inline ? 'inline' : 'attachment';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${dispositionType}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (err: any) {
    console.error('Download error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
