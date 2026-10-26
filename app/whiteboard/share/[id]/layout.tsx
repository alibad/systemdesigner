import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { alternates: { canonical: `/whiteboard/share/${encodeURIComponent(id)}` } };
}

export default function WhiteboardShareIdLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
