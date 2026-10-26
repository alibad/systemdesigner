import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/projects/examples' },
};

export default function ProjectsExamplesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
