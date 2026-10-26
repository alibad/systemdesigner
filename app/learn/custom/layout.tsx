import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/learn/custom' },
};

export default function LearnCustomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
