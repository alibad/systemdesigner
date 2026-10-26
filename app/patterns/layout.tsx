import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/patterns' },
};

export default function PatternsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
