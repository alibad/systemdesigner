'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import FeedbackWidget from '@/components/feedback/FeedbackWidget';
import { initDiagnostics } from '@/lib/feedback/diagnostics';

export default function ControlsWrapper() {
  const pathname = usePathname();
  const isWhiteboard = pathname?.startsWith('/whiteboard');

  // Buffer console/network logs from page load so feedback diagnostics work.
  useEffect(() => {
    initDiagnostics();
  }, []);

  if (isWhiteboard) return null;

  return <FeedbackWidget />;
}
