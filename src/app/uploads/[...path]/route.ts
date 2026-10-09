import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.webp': 'image/webp',
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await context.params;

    if (!pathSegments || !pathSegments.length) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    const publicUploadsRoot = path.resolve(process.cwd(), 'public', 'uploads');
    const relativePath = path.join('uploads', ...pathSegments);
    const absolutePath = path.resolve(process.cwd(), 'public', relativePath);

    // Guard against directory traversal
    if (!absolutePath.startsWith(publicUploadsRoot)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: 'Target is not a file' }, { status: 400 });
    }

    const ext = path.extname(absolutePath).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const fileName = path.basename(absolutePath);
    const fileBuffer = fs.readFileSync(absolutePath);

    const { searchParams } = new URL(req.url);
    const forceDownload = searchParams.get('download') === '1' || searchParams.has('download');
    const disposition = forceDownload ? 'attachment' : 'inline';

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
      },
    });
  } catch (err: any) {
    console.error('Uploads route error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
