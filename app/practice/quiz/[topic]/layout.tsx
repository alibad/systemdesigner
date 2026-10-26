import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  return { alternates: { canonical: `/practice/quiz/${encodeURIComponent(topic)}` } };
}

export default function PracticeQuizTopicLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
