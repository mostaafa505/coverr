import PrintStudio from '@/components/studio/PrintStudio';

export default async function EditorPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  return <PrintStudio initialModelId={modelId} />;
}
