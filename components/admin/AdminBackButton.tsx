'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

export default function AdminBackButton() {
  const pathname = usePathname();

  // Only show on admin sub-pages, not on the main admin dashboard
  const isAdminSubpage = pathname.startsWith('/admin') && pathname !== '/admin';

  if (!isAdminSubpage) return null;

  // Determine back URL and label based on current path
  let backUrl = '/admin';
  let backLabel = 'Back to Dashboard';

  // Special case for user detail pages
  if (pathname.match(/^\/admin\/users\/[^/]+$/)) {
    backUrl = '/admin/users';
    backLabel = 'Back to Users';
  }

  return (
    <Link
      href={backUrl as any}
      className="inline-flex items-center text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
    >
      <ChevronLeft className="w-4 h-4 mr-1" />
      {backLabel}
    </Link>
  );
}