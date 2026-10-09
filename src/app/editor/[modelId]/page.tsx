import Studio from '@/components/studio/Studio';

export default async function EditorPage({ params }: { params: Promise<{ modelId: string }> }) {
  const { modelId } = await params;
  return <Studio initialModelId={decodeURIComponent(modelId)} />;
}
