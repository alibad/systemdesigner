"use client";
import { useEffect, useState } from 'react';

export type AnchorItem = { id: string; label: string };

export default function OnThisPage({ items }: { items: AnchorItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? -1 : 1));
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      {
        root: null,
        rootMargin: '0px 0px -65% 0px',
        threshold: [0, 1],
      }
    );
    items.forEach(i => {
      const el = document.getElementById(i.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [items]);

  return (
    <aside className="hidden xl:block">
      <nav aria-label="On this page" className="sticky top-4">
        <div className="text-xs font-semibold text-neutral-500 tracking-wide mb-2">ON THIS PAGE</div>
        <ul className="space-y-1">
          {items.map(item => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className={`block rounded px-2 py-1 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                  activeId === item.id
                    ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}


