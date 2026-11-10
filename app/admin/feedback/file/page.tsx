'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ref, getBlob } from 'firebase/storage';
import { useAuth } from '@/hooks/useAuth';
import { storage } from '@/lib/firebase';
import { feedbackObjectPath, isSafeFeedbackFileName } from '@/lib/feedback/private-files';

/**
 * Team-only viewer for a private feedback upload. Public GitHub issues link
 * here; the file is read with the signed-in maintainer's Firebase session
 * (storage.rules), so the link alone opens nothing.
 */
function FeedbackFileViewer() {
  const name = useSearchParams().get('name') || '';
  const { isAuthenticated, isAdmin } = useAuth();
  const [file, setFile] = useState<{ url: string; type: string; text?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    if (!isSafeFeedbackFileName(name)) {
      setError('This link does not name a feedback file.');
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    (async () => {
      try {
        const blob = await getBlob(ref(storage, feedbackObjectPath(name)));
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        const text = blob.type.startsWith('text/') ? await blob.text() : undefined;
        if (!cancelled) setFile({ url: objectUrl, type: blob.type, text });
      } catch {
        if (!cancelled) setError('Could not open the file. It may not exist, or this account cannot read it.');
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [isAdmin, name]);

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <h1 className="text-xl font-semibold mb-2">Team only</h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            Sign in with the maintainer account to open this feedback file.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold break-all">{name}</h1>
        {file && (
          <a href={file.url} download={name} className="text-sm text-blue-600 dark:text-blue-400 hover:underline shrink-0">
            Download
          </a>
        )}
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!file && !error && <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />}
      {file?.type.startsWith('image/') && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={file.url} alt={name} className="max-w-full rounded-lg border border-neutral-200 dark:border-neutral-700" />
      )}
      {file?.type.startsWith('video/') && <video src={file.url} controls className="w-full rounded-lg" />}
      {file?.type.startsWith('audio/') && <audio src={file.url} controls className="w-full" />}
      {file?.text !== undefined && (
        <pre className="text-xs whitespace-pre-wrap break-all rounded-lg border border-neutral-200 dark:border-neutral-700 p-4 max-h-[70vh] overflow-auto">
          {file.text}
        </pre>
      )}
    </div>
  );
}

export default function AdminFeedbackFilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <FeedbackFileViewer />
    </Suspense>
  );
}
