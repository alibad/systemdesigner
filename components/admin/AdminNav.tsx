'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import NotificationCenter from '@/components/admin/NotificationCenter';

interface AdminNavProps {
  customBackUrl?: string;
  customBackLabel?: string;
}

export default function AdminNav({ customBackUrl, customBackLabel }: AdminNavProps) {
  // AdminNav functionality has been completely moved to the main layout header
  // This component is now deprecated and returns null
  return null;
}