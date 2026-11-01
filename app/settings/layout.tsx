import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Customize your learning experience and manage offline content.',
  alternates: { canonical: '/settings' },
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
