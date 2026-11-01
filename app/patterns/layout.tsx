import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Design Patterns',
  description: 'Production-ready architectural templates and patterns: proven solutions for common system design challenges, with implementation guides.',
  alternates: { canonical: '/patterns' },
};

export default function PatternsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
