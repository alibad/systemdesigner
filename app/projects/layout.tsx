import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Projects',
  description: 'Create, organize, and continue your system design projects.',
  alternates: { canonical: '/projects' },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
