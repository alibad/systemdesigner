import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/ml-systems/reference' },
};

export default function MlSystemsReferenceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
