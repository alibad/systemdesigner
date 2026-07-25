'use client';

import { usePathname } from 'next/navigation';
import NotificationCenter from '@/components/admin/NotificationCenter';

export default function AdminHeaderNotifications() {
  const pathname = usePathname();

  // Show notification center on all admin pages
  const isAdminPage = pathname.startsWith('/admin');

  if (!isAdminPage) return null;

  return <NotificationCenter />;
}