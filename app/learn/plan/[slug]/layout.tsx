import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { alternates: { canonical: `/learn/plan/${encodeURIComponent(slug)}` } };
}

export default function LearnPlanSlugLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
