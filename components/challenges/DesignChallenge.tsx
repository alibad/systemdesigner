'use client';

/**
 * The flagship gradeable block: "draw the architecture, get graded against a rubric."
 *
 * Reuses the proven tldraw setup from app/whiteboard/page.tsx (direct import + CSS,
 * onMount editor capture, the geo-rectangle component pattern). A constrained palette
 * steers the learner toward the right building blocks; they wire them with tldraw's
 * arrow tool. On submit we serialize the store and POST the raw records to /api/grade,
 * which extracts the topology and scores it deterministically server-side — the answer
 * key never reaches the browser.
 */

import { useRef, useState } from 'react';
import { Tldraw, createShapeId, type Editor } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { useChallenge } from '@/hooks/useChallenge';
import GradeResultCard from './GradeResultCard';

const PALETTE: Record<string, { icon: string; label: string }> = {
  user: { icon: '👤', label: 'User/Client' },
  balancer: { icon: '⚖️', label: 'Load Balancer' },
  api: { icon: '🔌', label: 'API Gateway' },
  server: { icon: '🖥️', label: 'Server' },
  cache: { icon: '⚡', label: 'Cache' },
  database: { icon: '🗄️', label: 'Database' },
  queue: { icon: '📮', label: 'Message Queue' },
  cdn: { icon: '🌐', label: 'CDN' },
  monitor: { icon: '📊', label: 'Monitoring' },
};

const ALL_TYPES = Object.keys(PALETTE);

export default function DesignChallenge({
  challengeId,
  prompt,
  palette = ALL_TYPES,
  title = 'Design Challenge',
}: {
  challengeId: string;
  prompt: string;
  palette?: string[];
  title?: string;
}) {
  const editorRef = useRef<Editor | null>(null);
  const placedRef = useRef(0);
  const [narration, setNarration] = useState('');
  const { submit, submitting, result, xpAwarded, error, reset } = useChallenge(challengeId, 'design');

  const addComponent = (type: string) => {
    const editor = editorRef.current;
    const meta = PALETTE[type];
    if (!editor || !meta) return;

    // Spread placements out from the viewport center so they don't stack.
    const vp = editor.getViewportPageBounds();
    const n = placedRef.current++;
    const x = vp.center.x - 75 + (n % 3) * 180 - 180;
    const y = vp.center.y - 40 + Math.floor(n / 3) * 120 - 120;
    try {
      editor.createShapes([
        {
          id: createShapeId(),
          type: 'geo',
          x,
          y,
          props: { geo: 'rectangle', w: 150, h: 80, text: `${meta.icon} ${meta.label}` },
        },
      ]);
    } catch {
      editor.createShapes([
        { id: createShapeId(), type: 'text', x, y, props: { text: `${meta.icon} ${meta.label}` } },
      ]);
    }
  };

  const clearCanvas = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const ids = Array.from(editor.getCurrentPageShapeIds());
    if (ids.length) editor.deleteShapes(ids);
    placedRef.current = 0;
    reset();
  };

  const handleSubmit = async () => {
    const editor = editorRef.current;
    if (!editor) return;
    const raw: any = editor.store.serialize();
    const records = raw?.records ?? raw;
    await submit({ records, narration: narration.trim() || undefined });
  };

  return (
    <section className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-card p-6 my-8">
      <div className="flex items-center gap-2 mb-2">
        <span className="rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          Graded Challenge
        </span>
        <h3 className="text-xl font-bold text-neutral-900 dark:text-white">{title}</h3>
      </div>
      <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-4">{prompt}</p>

      {/* Constrained palette */}
      <div className="mb-3 flex flex-wrap gap-2">
        {palette
          .filter((t) => PALETTE[t])
          .map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => addComponent(t)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            >
              <span aria-hidden>{PALETTE[t].icon}</span>
              <span>{PALETTE[t].label}</span>
            </button>
          ))}
      </div>
      <p className="mb-3 text-xs text-neutral-500 dark:text-neutral-400">
        Add components, then use the arrow tool to connect them into a request path.
      </p>

      {/* Canvas */}
      <div
        className="relative w-full overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800"
        style={{ height: 460 }}
      >
        <Tldraw
          autoFocus={false}
          persistenceKey={`challenge-${challengeId}`}
          onMount={(editor) => {
            editorRef.current = editor;
          }}
        />
      </div>

      {/* Narration (optional, fuels the non-scoring AI coaching note) */}
      <label className="mt-4 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
        Narrate your design (optional — what handles the read load, and why?)
      </label>
      <textarea
        value={narration}
        onChange={(e) => setNarration(e.target.value)}
        rows={2}
        placeholder="e.g. Reads dominate 100:1, so I check the cache first and fall back to the DB on a miss…"
        className="mt-1 w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 p-2 text-sm text-neutral-900 dark:text-neutral-100"
      />

      <div className="mt-3 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? 'Grading…' : result ? 'Resubmit' : 'Submit for grading'}
        </button>
        <button
          type="button"
          onClick={clearCanvas}
          className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
          Clear canvas
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-5">
          <GradeResultCard result={result} xpAwarded={xpAwarded} />
        </div>
      )}
    </section>
  );
}
