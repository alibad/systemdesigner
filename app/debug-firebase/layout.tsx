import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Firebase Debug',
  robots: { index: false, follow: false },
};

// A development diagnostic that writes test progress to Firebase. Production builds answer 404.
export default function DebugFirebaseLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return <>{children}</>;
}
