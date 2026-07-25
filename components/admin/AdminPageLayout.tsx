'use client';

import { ReactNode } from 'react';
import AdminNav from './AdminNav';

interface AdminPageLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
  maxWidth?: 'default' | 'wide' | 'full';
}

export default function AdminPageLayout({
  children,
  title,
  description,
  maxWidth = 'default'
}: AdminPageLayoutProps) {
  const maxWidthClass = {
    default: 'max-w-7xl',
    wide: 'max-w-screen-2xl',
    full: 'max-w-none'
  }[maxWidth];

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <AdminNav />
      <div className={`${maxWidthClass} mx-auto px-4 py-6`}>
        {(title || description) && (
          <div className="mb-8">
            {title && <h1 className="text-3xl font-bold mb-2">{title}</h1>}
            {description && (
              <p className="text-neutral-600 dark:text-neutral-400">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
