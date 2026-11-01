import type { Metadata } from 'next';

export { default } from './ReferenceIndexPage';

export const metadata: Metadata = {
  title: 'System Design Reference Library',
  description: 'Quick system design references: latency and data-size numbers, rules of thumb, API and security checklists, and database and cloud comparisons.',
  alternates: { canonical: '/reference' },
};
