'use client';

interface SkipLink {
  href: string;
  label: string;
}

interface SkipLinksProps {
  links?: SkipLink[];
}

const defaultSkipLinks: SkipLink[] = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#user-menu', label: 'Skip to user menu' },
  { href: '#side-nav', label: 'Skip to navigation' },
];

export default function SkipLinks({ links = defaultSkipLinks }: SkipLinksProps) {
  return (
    <div className="sr-only focus-within:not-sr-only">
      <div className="fixed top-0 left-0 z-[200] bg-indigo-600 text-white p-2 rounded-br-lg shadow-lg">
        {links.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="block px-4 py-2 text-sm font-medium hover:bg-indigo-700 focus:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-white focus:ring-inset rounded"
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const target = document.querySelector(link.href);
                if (target) {
                  target.scrollIntoView({ behavior: 'smooth' });
                  // Focus the target element if it's focusable
                  if (target instanceof HTMLElement) {
                    target.focus({ preventScroll: true });
                  }
                }
              }
            }}
          >
            {link.label}
          </a>
        ))}
      </div>
    </div>
  );
}