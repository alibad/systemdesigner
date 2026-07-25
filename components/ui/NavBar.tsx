'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { NAV_GROUPS } from '@/components/ui/nav-config';
import LearningPlansNav from '@/components/LearningPlansNav';

export default function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden relative" ref={menuRef}>
      {/* Mobile menu button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all"
        aria-label="Open navigation menu"
        aria-expanded={isOpen}
      >
        <svg
          className={`w-6 h-6 transition-transform ${isOpen ? 'rotate-45' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Mobile menu overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      )}

      {/* Mobile menu panel */}
      <div className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-white dark:bg-neutral-950 border-r border-neutral-200 dark:border-neutral-800 shadow-xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
          <Link
            href="/"
            className="text-lg font-semibold text-neutral-900 dark:text-neutral-100"
            onClick={() => setIsOpen(false)}
          >
            System Designer
          </Link>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Close navigation menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Learning Plans Section */}
          <LearningPlansNav />

          {/* Navigation Groups */}
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-3 px-2">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));

                  return (
                    <div key={item.href}>
                      <Link
                        href={item.href as any}
                        className={`flex items-center px-4 py-3 rounded-lg transition-colors text-sm font-medium ${
                          isActive
                            ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                            : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                        }`}
                        onClick={() => setIsOpen(false)}
                      >
                        {item.icon ? (
                          <item.icon className="mr-3 h-5 w-5 text-neutral-500 dark:text-neutral-400" />
                        ) : null}
                        <span>{item.label}</span>
                      </Link>

                      {/* Sub-items for mobile */}
                      {item.subItems && isActive && (
                        <div className="ml-6 mt-2 space-y-1">
                          {item.subItems.map(subItem => {
                            const isSubActive = pathname === subItem.href || pathname?.startsWith(subItem.href);
                            return (
                              <Link
                                key={subItem.href}
                                href={subItem.href as any}
                                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                                  isSubActive
                                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white'
                                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/30'
                                }`}
                                onClick={() => setIsOpen(false)}
                              >
                                {subItem.label}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
}


