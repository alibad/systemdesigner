'use client';

import ContentRouteShell from '@/components/content/ContentRouteShell';

export default function FundamentalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ContentRouteShell section="fundamentals" enableKeywordProcessor>
      {children}
    </ContentRouteShell>
  );
}
