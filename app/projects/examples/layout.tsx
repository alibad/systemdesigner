import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Example System Design Projects',
  description: 'Explore pre-built system design examples. Preview them read-only or clone one into your projects to customize.',
  alternates: { canonical: '/projects/examples' },
};

export default function ProjectsExamplesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
