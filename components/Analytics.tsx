'use client';

import { useEffect } from 'react';
import { useAnalytics } from '@/hooks/useAnalytics';

/**
 * Analytics component that handles automatic page view tracking
 * Add this to your root layout to enable analytics across the entire app
 */
export default function Analytics() {
  // This will automatically track page views when pathname changes
  useAnalytics();

  useEffect(() => {
    // Check analytics status in development (console only)
    if (process.env.NODE_ENV === 'development') {
      import('@/lib/analytics-debug').then(({ checkAnalyticsStatus }) => {
        checkAnalyticsStatus();
      });
    }
  }, []);

  // This component doesn't render anything visible
  return null;
}