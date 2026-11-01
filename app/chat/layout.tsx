import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ask AI',
  description: 'Ask an AI coach questions about system design.',
  alternates: { canonical: '/chat' },
};

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
