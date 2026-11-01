import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'System Design Whiteboard',
  description: 'Draw system architectures, collaborate in real time, and share your designs with others.',
  alternates: { canonical: '/whiteboard' },
};

export default function WhiteboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
