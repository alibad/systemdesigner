import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Scalability Fundamentals Quiz',
  description: 'Test your understanding of horizontal and vertical scaling, load balancing, and scalability patterns for building scalable systems.',
  alternates: { canonical: '/quiz/scalability-basics' },
};

export default function QuizScalabilityBasicsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
