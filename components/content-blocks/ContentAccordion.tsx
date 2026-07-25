'use client';

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronDown } from 'lucide-react';

interface AccordionContextValue {
  expandedId: string | null;
  toggle: (id: string, triggerId: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

export function ContentAccordion({
  defaultOpen = 'clarifying',
  children,
}: {
  defaultOpen?: string;
  children: ReactNode;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(defaultOpen);
  const anchorTimeoutRef = useRef<number | null>(null);
  const previousOverflowAnchorRef = useRef<string | null>(null);
  const pendingAnchorRef = useRef<{ triggerId: string; top: number } | null>(null);

  const restoreScrollAnchoring = () => {
    if (previousOverflowAnchorRef.current === null) return;
    document.documentElement.style.overflowAnchor = previousOverflowAnchorRef.current;
    previousOverflowAnchorRef.current = null;
  };

  useEffect(
    () => () => {
      if (anchorTimeoutRef.current !== null) window.clearTimeout(anchorTimeoutRef.current);
      restoreScrollAnchoring();
    },
    [],
  );

  useLayoutEffect(() => {
    const pending = pendingAnchorRef.current;
    if (!pending) return;

    pendingAnchorRef.current = null;
    const trigger = document.getElementById(pending.triggerId);
    if (!trigger) return;

    const triggerHeight = trigger.getBoundingClientRect().height;
    const targetTop = Math.max(96, Math.min(pending.top, window.innerHeight - triggerHeight - 24));
    const scrollDelta = trigger.getBoundingClientRect().top - targetTop;
    if (Math.abs(scrollDelta) < 1) return;

    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollBy(0, scrollDelta);
    root.style.scrollBehavior = previousScrollBehavior;
  }, [expandedId]);

  const toggle = (id: string, triggerId: string) => {
    const opening = expandedId !== id;
    const trigger = document.getElementById(triggerId);

    if (previousOverflowAnchorRef.current === null) {
      previousOverflowAnchorRef.current = document.documentElement.style.overflowAnchor;
      document.documentElement.style.overflowAnchor = 'none';
    }
    if (anchorTimeoutRef.current !== null) window.clearTimeout(anchorTimeoutRef.current);
    anchorTimeoutRef.current = window.setTimeout(restoreScrollAnchoring, 700);

    pendingAnchorRef.current =
      opening && trigger ? { triggerId, top: trigger.getBoundingClientRect().top } : null;
    setExpandedId(opening ? id : null);
  };

  return (
    <AccordionContext.Provider
      value={{
        expandedId,
        toggle,
      }}
    >
      <div
        className="not-prose my-8 border-y border-neutral-200 dark:border-neutral-800"
        data-content-accordion
      >
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export function ContentAccordionItem({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  const context = useContext(AccordionContext);
  if (!context) throw new Error('ContentAccordionItem must be nested inside ContentAccordion');

  const expanded = context.expandedId === id;
  const panelId = `content-accordion-panel-${id}`;
  const triggerId = `content-accordion-trigger-${id}`;

  return (
    <section className="scroll-mt-24 border-b border-neutral-200 last:border-b-0 dark:border-neutral-800">
      <h2 className="m-0 text-base font-semibold">
        <button
          id={triggerId}
          type="button"
          aria-controls={panelId}
          aria-expanded={expanded}
          onClick={() => context.toggle(id, triggerId)}
          className="flex min-h-16 w-full items-center justify-between gap-4 px-2 py-4 text-left text-neutral-900 hover:bg-neutral-50 md:px-3 dark:text-neutral-100 dark:hover:bg-neutral-900/70"
        >
          <span>{title}</span>
          <ChevronDown
            aria-hidden="true"
            className={`h-5 w-5 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </h2>
      {expanded && (
        <div
          id={panelId}
          role="region"
          aria-labelledby={triggerId}
          className="border-t border-neutral-200 px-2 py-7 md:px-3 dark:border-neutral-800"
        >
          <div className="prose prose-neutral dark:prose-invert max-w-none">{children}</div>
        </div>
      )}
    </section>
  );
}
