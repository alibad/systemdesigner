import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ML Technology Deep Dives',
  description: 'Implementation guides for ML infrastructure tools: architecture, deployment patterns, and best practices.',
  alternates: { canonical: '/ml-systems/technology' },
};

export default function MlSystemsTechnologyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
