import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { alternates: { canonical: `/projects/${encodeURIComponent(id)}` } };
}

export default function ProjectsIdLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
