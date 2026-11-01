import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create a Learning Plan',
  description: 'Choose how to create your personalized learning plan.',
  alternates: { canonical: '/learn/custom' },
};

export default function LearnCustomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
