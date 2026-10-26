import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/quiz/scalability-basics' },
};

export default function QuizScalabilityBasicsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
