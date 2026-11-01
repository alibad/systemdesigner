import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Whiteboards',
  description: 'Create and manage your system design whiteboards.',
  alternates: { canonical: '/whiteboard/manage' },
};

export default function WhiteboardManageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
