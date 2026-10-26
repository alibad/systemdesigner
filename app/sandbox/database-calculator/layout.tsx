import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/sandbox/database-calculator' },
};

export default function SandboxDatabaseCalculatorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
