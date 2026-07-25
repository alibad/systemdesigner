'use client';

import React, { useId, useState } from 'react';

const TAB_STYLES = [
  {
    marker: 'bg-blue-500',
    active: 'border-blue-600 bg-blue-50 text-blue-800 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-200',
    panel: 'border-l-blue-500 bg-blue-50/30 dark:border-l-blue-400 dark:bg-blue-950/10',
  },
  {
    marker: 'bg-rose-500',
    active: 'border-rose-600 bg-rose-50 text-rose-800 dark:border-rose-400 dark:bg-rose-950/40 dark:text-rose-200',
    panel: 'border-l-rose-500 bg-rose-50/30 dark:border-l-rose-400 dark:bg-rose-950/10',
  },
  {
    marker: 'bg-amber-500',
    active: 'border-amber-600 bg-amber-50 text-amber-900 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-200',
    panel: 'border-l-amber-500 bg-amber-50/30 dark:border-l-amber-400 dark:bg-amber-950/10',
  },
  {
    marker: 'bg-violet-500',
    active: 'border-violet-600 bg-violet-50 text-violet-800 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-200',
    panel: 'border-l-violet-500 bg-violet-50/30 dark:border-l-violet-400 dark:bg-violet-950/10',
  },
  {
    marker: 'bg-emerald-500',
    active: 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:border-emerald-400 dark:bg-emerald-950/40 dark:text-emerald-200',
    panel: 'border-l-emerald-500 bg-emerald-50/30 dark:border-l-emerald-400 dark:bg-emerald-950/10',
  },
] as const;

export function ContentTab({
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

export function ContentTabs({ children }: { children: React.ReactNode }) {
  const tabs = React.Children.toArray(children).filter(
    (child): child is React.ReactElement<{ title: string; children: React.ReactNode }> =>
      React.isValidElement(child) && typeof child.props.title === 'string'
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const id = useId();

  if (tabs.length === 0) return null;

  const selectedIndex = Math.min(activeIndex, tabs.length - 1);

  return (
    <div className="not-prose my-6 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div
        className="flex min-h-11 overflow-x-auto border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900"
        role="tablist"
        aria-label="Content views"
      >
        {tabs.map((tab, index) => {
          const style = TAB_STYLES[index % TAB_STYLES.length];
          return (
            <button
              key={`${tab.props.title}-${index}`}
              id={`${id}-tab-${index}`}
              type="button"
              role="tab"
              aria-controls={`${id}-panel-${index}`}
              aria-selected={selectedIndex === index}
              tabIndex={selectedIndex === index ? 0 : -1}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-inset ${
                selectedIndex === index
                  ? style.active
                  : 'border-transparent text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100'
              }`}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                event.preventDefault();
                const direction = event.key === 'ArrowRight' ? 1 : -1;
                const nextIndex = (index + direction + tabs.length) % tabs.length;
                setActiveIndex(nextIndex);
                document.getElementById(`${id}-tab-${nextIndex}`)?.focus();
              }}
            >
              <span
                aria-hidden="true"
                className={`h-4 w-1 rounded-sm ${style.marker} ${selectedIndex === index ? 'opacity-100' : 'opacity-45'}`}
              />
              {tab.props.title}
            </button>
          );
        })}
      </div>

      {tabs.map((tab, index) => (
        <div
          key={`${tab.props.title}-${index}`}
          id={`${id}-panel-${index}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${index}`}
          hidden={selectedIndex !== index}
          className={`markdoc-tab-copy min-h-40 max-w-none border-l-4 p-6 md:p-8 ${TAB_STYLES[index % TAB_STYLES.length].panel}`}
        >
          {tab.props.children}
        </div>
      ))}
    </div>
  );
}
