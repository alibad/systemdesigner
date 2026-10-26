import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/ml-systems/technology' },
};

export default function MlSystemsTechnologyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
