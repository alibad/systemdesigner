'use client';

import Link from 'next/link';

interface TechnologyReferenceProps {
  title: string;
  href: string;
  description: string;
  type?: 'primary' | 'secondary';
  icon?: string;
}

export function TechnologyReference({ 
  title, 
  href, 
  description, 
  type = 'secondary',
  icon = '🔧'
}: TechnologyReferenceProps) {
  const baseClasses = "rounded-lg border p-4 transition-all hover:shadow-md";
  const typeClasses = type === 'primary' 
    ? "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30"
    : "border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800";

  // Cast to satisfy typed routes; allowed to be dynamic across various paths
  return (
    <Link href={href as any} className={`${baseClasses} ${typeClasses} block`}>
      <div className="flex items-start gap-3">
        <span className="text-lg">{icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-neutral-900 dark:text-neutral-100 mb-1 flex items-center gap-2">
            {title}
            <span className="text-xs text-neutral-500 dark:text-neutral-400">→</span>
          </h4>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
        </div>
      </div>
    </Link>
  );
}

interface TechnologyReferencesProps {
  title?: string;
  references: Array<{
    title: string;
    href: string;
    description: string;
    type?: 'primary' | 'secondary';
    icon?: string;
  }>;
}

export function TechnologyReferences({ 
  title = "Related Technologies", 
  references 
}: TechnologyReferencesProps) {
  return (
    <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6">
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-4">
        {title}
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {references.map((ref, idx) => (
          <TechnologyReference
            key={idx}
            title={ref.title}
            href={ref.href}
            description={ref.description}
            type={ref.type}
            icon={ref.icon}
          />
        ))}
      </div>
    </div>
  );
}