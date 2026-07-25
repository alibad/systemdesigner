'use client';

import ContentRouteShell from '@/components/content/ContentRouteShell';

export default function GenAILayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ContentRouteShell section="genai">
      {children}
    </ContentRouteShell>
  );
}
