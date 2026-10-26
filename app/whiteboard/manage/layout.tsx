import type { Metadata } from 'next';

export const metadata: Metadata = {
  alternates: { canonical: '/whiteboard/manage' },
};

export default function WhiteboardManageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
