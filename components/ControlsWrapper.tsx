'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import FeedbackWidget from '@/components/feedback/FeedbackWidget';
import AIChat from '@/components/AIChat';
import { initDiagnostics } from '@/lib/feedback/diagnostics';

interface AIPageContext {
  pageUrl: string;
  pageTitle: string;
  pageContent: string;
  selectedText?: string;
}

const EMPTY_AI_CONTEXT: AIPageContext = {
  pageUrl: '',
  pageTitle: '',
  pageContent: '',
};

export default function ControlsWrapper() {
  const pathname = usePathname();
  const isWhiteboard = pathname?.startsWith('/whiteboard');
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [aiContext, setAIContext] = useState<AIPageContext>(EMPTY_AI_CONTEXT);

  // Buffer console/network logs from page load so feedback diagnostics work.
  useEffect(() => {
    initDiagnostics();
  }, []);

  useEffect(() => {
    setIsAIChatOpen(false);
  }, [pathname]);

  const openAIChat = useCallback(() => {
    const contentRoot = document.querySelector(
      'article[data-content-shell], main, article, [role="main"]'
    );
    const pageContent = (contentRoot?.textContent || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 24_000);
    const selection = window.getSelection();
    const selectedText =
      selection && !selection.isCollapsed
        ? selection.toString().replace(/\s+/g, ' ').trim().slice(0, 4_000)
        : '';

    setAIContext({
      pageUrl: window.location.href,
      pageTitle: document.title,
      pageContent,
      selectedText: selectedText || undefined,
    });
    setIsAIChatOpen(true);
  }, []);

  if (isWhiteboard) return null;

  return (
    <>
      <FeedbackWidget onOpenAI={openAIChat} />
      <AIChat
        isOpen={isAIChatOpen}
        onClose={() => setIsAIChatOpen(false)}
        selectedText={aiContext.selectedText}
        pageUrl={aiContext.pageUrl}
        pageTitle={aiContext.pageTitle}
        pageContent={aiContext.pageContent}
      />
    </>
  );
}
