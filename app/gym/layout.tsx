import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/gym' },
};

export default function GymLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
