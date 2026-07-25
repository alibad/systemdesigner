'use client';

import { useState } from 'react';

export default function RagSystemsDemo() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');

  function runDemo() {
    if (!query.trim()) return;
    const answer = query.toLowerCase().includes('vector')
      ? 'Vector databases store high-dimensional embeddings that represent the semantic meaning of text.'
      : 'RAG systems combine retrieval of relevant documents with language-model generation to produce grounded, context-aware responses.';

    setResponse(`Answer: ${answer}\n\nSources:\n[1] Introduction to Vector Databases (Section 2.1)\n[2] RAG Architecture Patterns (Section 4.3)\n[3] Production Implementation Guide (Section 7.2)\n\nConfidence: High (based on 3 relevant sources)`);
  }

  return (
    <div className="rounded-md border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-800 dark:bg-indigo-950/20">
      <label htmlFor="rag-demo-query" className="mb-2 block text-sm font-medium text-neutral-900 dark:text-neutral-100">
        Ask about AI or ML, for example: How do vector databases work?
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="rag-demo-query"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setResponse('');
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') runDemo();
          }}
          placeholder="Enter your question..."
          className="min-w-0 flex-1 rounded-md border border-indigo-200 bg-white px-3 py-2 text-neutral-900 dark:border-indigo-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <button
          type="button"
          onClick={runDemo}
          disabled={!query.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ask RAG
        </button>
      </div>
      {response && (
        <div className="mt-4 rounded-md border border-indigo-200 bg-white p-4 dark:border-indigo-700 dark:bg-neutral-900">
          <p className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">RAG response</p>
          <pre className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-300">{response}</pre>
        </div>
      )}
    </div>
  );
}
