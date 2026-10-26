import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/workshop/system-design' },
};

export default function WorkshopSystemDesignLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
