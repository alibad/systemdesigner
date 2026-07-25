'use client';

import type React from 'react';
import { usePathname } from 'next/navigation';
import { ClientSideKeywordProcessor } from '@/components/ClientSideKeywordProcessor';
import {
  getRenderableContentByPath,
  getSectionRouteConfig,
  type ContentSection,
} from '@/lib/content-model';

interface ContentRouteShellProps {
  section: ContentSection;
  children: React.ReactNode;
  enableKeywordProcessor?: boolean;
}

export default function ContentRouteShell({
  section,
  children,
  enableKeywordProcessor = false,
}: ContentRouteShellProps) {
  const pathname = usePathname();
  const sectionConfig = getSectionRouteConfig(section);
  const content = getRenderableContentByPath(pathname);
  const isContentPage = content?.section === section && pathname !== sectionConfig.landingPath;

  return (
    <>
      <div className="smart-content-wrapper" data-enable-linking={!!isContentPage && enableKeywordProcessor}>
        {children}
      </div>

      {enableKeywordProcessor && <ClientSideKeywordProcessor />}
    </>
  );
}
