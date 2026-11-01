import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Learning Plans',
  description: 'Create personalized learning paths and track your progress.',
  alternates: { canonical: '/learn/my-plans' },
};

export default function LearnMyPlansLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
