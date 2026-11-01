import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Achievements',
  description: 'Track your learning progress and unlock badges.',
  alternates: { canonical: '/achievements' },
};

export default function AchievementsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
