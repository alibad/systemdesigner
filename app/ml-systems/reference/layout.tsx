import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ML Systems Reference',
  description: 'Quick decision guides for ML infrastructure choices in production machine learning systems.',
  alternates: { canonical: '/ml-systems/reference' },
};

export default function MlSystemsReferenceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
