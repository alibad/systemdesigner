import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/learn/my-plans' },
};

export default function LearnMyPlansLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
