import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/whiteboard' },
};

export default function WhiteboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
