import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Interview Gym: System Design Mock Interviews',
  description: 'Practice system design interviews with timed sessions and detailed rubric scoring. Build confidence through repetition and feedback.',
  alternates: { canonical: '/gym' },
};

export default function GymLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
