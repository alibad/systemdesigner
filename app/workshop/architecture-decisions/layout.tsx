import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/workshop/architecture-decisions' },
};

export default function WorkshopArchitectureDecisionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
