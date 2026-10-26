import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/achievements' },
};

export default function AchievementsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
