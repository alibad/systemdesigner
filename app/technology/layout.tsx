'use client';

import ContentRouteShell from '@/components/content/ContentRouteShell';

export default function TechnologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ContentRouteShell section="technology" enableKeywordProcessor>
      {children}
    </ContentRouteShell>
  );
}
