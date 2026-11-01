import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Create a System Design Project',
  description: 'Describe your system idea and get guided step by step through architecting it.',
  alternates: { canonical: '/projects/create' },
};

export default function ProjectsCreateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
