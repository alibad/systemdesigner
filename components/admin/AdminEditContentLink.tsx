'use client';

import Link from 'next/link';
import { FilePenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export default function AdminEditContentLink({
  section,
  slug,
}: {
  section: string;
  slug: string;
}) {
  const { isAdmin, loading } = useAuth();
  if (loading || !isAdmin) return null;

  return (
    <div className="mt-8 flex justify-end border-t border-neutral-200 pt-6 dark:border-neutral-800">
      <Button variant="outline" asChild>
        <Link href={`/admin/content/editor/${section}/${slug}` as any}>
          <FilePenLine className="mr-2 h-4 w-4" />
          Edit lesson content
        </Link>
      </Button>
    </div>
  );
}
