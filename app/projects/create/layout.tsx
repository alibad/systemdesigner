import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/projects/create' },
};

export default function ProjectsCreateLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
