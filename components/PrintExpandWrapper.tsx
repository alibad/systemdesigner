'use client';

import { useEffect, useState, ReactNode } from 'react';

/**
 * PrintExpandWrapper - Automatically expands all collapsible sections when printing
 *
 * Usage:
 * Wrap your page content with this component. It will automatically detect
 * print events and temporarily expand all sections.
 *
 * Example:
 * <PrintExpandWrapper onPrintExpand={setExpandedSection}>
 *   <YourPageContent />
 * </PrintExpandWrapper>
 */

interface PrintExpandWrapperProps {
  children: ReactNode;
  onPrintExpand?: (value: 'all' | null) => void;
}

export default function PrintExpandWrapper({
  children,
  onPrintExpand
}: PrintExpandWrapperProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const handleBeforePrint = () => {
      setIsPrinting(true);
      if (onPrintExpand) {
        onPrintExpand('all');
      }
    };

    const handleAfterPrint = () => {
      setIsPrinting(false);
      if (onPrintExpand) {
        onPrintExpand(null);
      }
    };

    // Listen for print events
    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    // Also handle Cmd+P / Ctrl+P via matchMedia
    const printMediaQuery = window.matchMedia('print');
    const handlePrintMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        handleBeforePrint();
      } else {
        handleAfterPrint();
      }
    };

    printMediaQuery.addEventListener('change', handlePrintMediaChange);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      printMediaQuery.removeEventListener('change', handlePrintMediaChange);
    };
  }, [onPrintExpand]);

  return <>{children}</>;
}

/**
 * Hook version for more control
 */
export function usePrintExpand() {
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    const handleBeforePrint = () => setIsPrinting(true);
    const handleAfterPrint = () => setIsPrinting(false);

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);

    const printMediaQuery = window.matchMedia('print');
    const handlePrintMediaChange = (e: MediaQueryListEvent) => {
      setIsPrinting(e.matches);
    };

    printMediaQuery.addEventListener('change', handlePrintMediaChange);

    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
      printMediaQuery.removeEventListener('change', handlePrintMediaChange);
    };
  }, []);

  return isPrinting;
}