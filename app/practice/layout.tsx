'use client';

import ContentRouteShell from '@/components/content/ContentRouteShell';

export default function PracticeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ContentRouteShell section="practice">
      {children}
    </ContentRouteShell>
  );
}
