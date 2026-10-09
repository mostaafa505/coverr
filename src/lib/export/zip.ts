import { zipSync } from 'fflate';

export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = new Uint8Array(await f.blob.arrayBuffer());
  const zipped = zipSync(entries, { level: 0 }); // الملفات مضغوطة أصلًا
  return new Blob([zipped as BlobPart], { type: 'application/zip' });
}
