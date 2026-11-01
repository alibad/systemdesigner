import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { INTERVIEW_PROMPTS } from '@/lib/interview-sessions';

function findPrompt(id: string) {
  return INTERVIEW_PROMPTS.find((prompt) => prompt.id === id);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const prompt = findPrompt(id);
  if (!prompt) return {};
  return {
    title: `${prompt.title} Mock Interview`,
    description: `${prompt.description}. A timed ${prompt.duration}-minute system design interview with rubric scoring.`,
    alternates: { canonical: `/gym/${encodeURIComponent(id)}` },
  };
}

// The session page is a client component, so unknown prompt ids are rejected here: a real 404
// instead of an empty 200.
export default async function GymIdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!findPrompt(id)) notFound();
  return <>{children}</>;
}
