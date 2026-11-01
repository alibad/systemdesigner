import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Database Scaling Calculator',
  description: 'Estimate database capacity needs and get actionable scaling suggestions.',
  alternates: { canonical: '/sandbox/database-calculator' },
};

export default function SandboxDatabaseCalculatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
