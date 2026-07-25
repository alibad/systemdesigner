'use client';

import ContentRouteShell from '@/components/content/ContentRouteShell';

export default function MLSystemsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ContentRouteShell section="ml-systems">
      {children}
    </ContentRouteShell>
  );
}
