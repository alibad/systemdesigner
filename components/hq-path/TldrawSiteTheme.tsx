'use client';

// Human Quest "Path" day and night for tldraw: puts the whiteboard in tldraw's own dark mode while the site
// is at night (the .dark class on <html>, set by the sun/moon button) and back to light by day.
// Render it as a child of <Tldraw>.
import { useEffect } from 'react';
import { useEditor } from '@tldraw/tldraw';

export default function TldrawSiteTheme() {
  const editor = useEditor();
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const colorScheme = root.classList.contains('dark') ? 'dark' : 'light';
      if (editor.user.getUserPreferences().colorScheme !== colorScheme) editor.user.updateUserPreferences({ colorScheme });
    };
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => watch.disconnect();
  }, [editor]);
  return null;
}
