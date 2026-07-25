'use client';

import { Moon, Sun } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

export function useThemePreference() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldDark = stored ? stored === 'dark' : prefersDark;
      const root = document.documentElement;
      const hasDark = root.classList.contains('dark');
      if (shouldDark !== hasDark) root.classList.toggle('dark', shouldDark);
      setIsDark(shouldDark);
    } catch {}
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((current) => {
      const next = !current;
      document.documentElement.classList.toggle('dark', next);
      try {
        localStorage.setItem('theme', next ? 'dark' : 'light');
        document.cookie = `theme=${next ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
      } catch {}
      return next;
    });
  }, []);

  return { isDark, toggleTheme };
}

interface ThemeToggleProps {
  isDark: boolean;
  isSelected: boolean;
  onToggle: () => void;
}

export default function ThemeToggle({ isDark, isSelected, onToggle }: ThemeToggleProps) {
  const Icon = isDark ? Moon : Sun;

  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={isSelected ? 0 : -1}
      aria-current={isSelected ? 'true' : undefined}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      onClick={onToggle}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-neutral-800 transition-colors hover:bg-neutral-100/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 dark:text-neutral-200 dark:hover:bg-neutral-800 ${
        isSelected ? 'bg-neutral-100/70 dark:bg-neutral-800' : ''
      }`}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>Theme</span>
      <span className="ml-auto text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {isDark ? 'Dark' : 'Light'}
      </span>
    </button>
  );
}
