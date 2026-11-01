import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Architecture Decision Workshop',
  description: 'Get personalized architecture recommendations based on your requirements and constraints.',
  alternates: { canonical: '/workshop/architecture-decisions' },
};

export default function WorkshopArchitectureDecisionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
