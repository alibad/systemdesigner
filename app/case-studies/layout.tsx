'use client';

import ContentRouteShell from '@/components/content/ContentRouteShell';

export default function CaseStudiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ContentRouteShell section="case-studies">
      {children}
    </ContentRouteShell>
  );
}
