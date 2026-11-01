import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Design Workshop',
  description: 'A guided process from requirements to architecture, worked through real system design problems.',
  alternates: { canonical: '/workshop/system-design' },
};

export default function WorkshopSystemDesignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
