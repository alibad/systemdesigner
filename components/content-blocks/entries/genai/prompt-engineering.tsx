'use client';

import { useState } from 'react';

export default function PromptEngineeringImprover() {
  const [prompt, setPrompt] = useState('');
  const [improvedPrompt, setImprovedPrompt] = useState('');

  function improvePrompt() {
    if (!prompt.trim()) return;

    let improved = prompt.trim();
    if (!improved.toLowerCase().includes('you are')) {
      improved = `You are an expert assistant. ${improved}`;
    }
    if (!improved.toLowerCase().includes('step') && !improved.toLowerCase().includes('format')) {
      improved += '\n\nProvide a clear, structured response.';
    }
    if (improved.length < 50) {
      improved += ' Be specific and detailed in your response.';
    }
    setImprovedPrompt(improved);
  }

  return (
    <div className="rounded-md border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-800 dark:bg-indigo-950/20">
      <label htmlFor="prompt-improver-input" className="mb-2 block text-sm font-medium text-neutral-900 dark:text-neutral-100">
        Enter your prompt
      </label>
      <textarea
        id="prompt-improver-input"
        value={prompt}
        onChange={(event) => {
          setPrompt(event.target.value);
          setImprovedPrompt('');
        }}
        placeholder="Enter a prompt to improve..."
        className="h-24 w-full rounded-md border border-indigo-200 bg-white px-3 py-2 text-neutral-900 dark:border-indigo-700 dark:bg-neutral-900 dark:text-neutral-100"
      />
      <button
        type="button"
        onClick={improvePrompt}
        disabled={!prompt.trim()}
        className="mt-3 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        Improve prompt
      </button>
      {improvedPrompt && (
        <div className="mt-4 rounded-md border border-indigo-200 bg-white p-4 dark:border-indigo-700 dark:bg-neutral-900">
          <p className="mb-2 text-sm font-medium text-neutral-900 dark:text-neutral-100">Improved version</p>
          <pre className="whitespace-pre-wrap text-sm text-indigo-800 dark:text-indigo-200">{improvedPrompt}</pre>
        </div>
      )}
    </div>
  );
}
