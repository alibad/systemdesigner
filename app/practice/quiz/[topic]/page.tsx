"use client";
import { useMemo, useState } from 'react';
import { notFound, useParams } from 'next/navigation';

type Question = {
  id: string;
  type: 'mcq' | 'short';
  prompt: string;
  choices?: string[];
  answer?: string | number | number[] | string[];
  explanation?: string;
};

const BANK: Record<string, Question[]> = {
  latency: [
    { id: 'q1', type: 'mcq', prompt: 'Typical round trip in a datacenter?', choices: ['5 μs', '50 μs', '500 μs', '5 ms'], answer: '500 μs', explanation: 'Rough order of magnitude; varies by fabric.' },
    { id: 'q2', type: 'short', prompt: 'If 1 ns were 1 second, how many days is 1 ms?' , answer: '11.6 days', explanation: 'Scale analogy from the reference.'},
  ],
  infra: [
    { id: 'q3', type: 'mcq', prompt: 'Typical TLS 1.3 handshake cost?', choices: ['1–3 ms', '10–30 ms', '100–300 ms'], answer: '10–30 ms' },
  ],
  cdn: [
    { id: 'q4', type: 'mcq', prompt: 'Edge latency with CDN (typical)?', choices: ['5–15 ms', '50–150 ms'], answer: '5–15 ms' },
  ]
};

export default function QuizPlayer() {
  const params = useParams<{ topic: string }>();
  const topic = params.topic;
  const questions = useMemo(() => BANK[topic] ?? [], [topic]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  if (!BANK[topic]) notFound();

  const q = questions[index];
  const setAnswer = (val: string) => setAnswers(a => ({ ...a, [q.id]: val }));
  const next = () => {
    if (index + 1 < questions.length) setIndex(index + 1);
    else setDone(true);
  };

  const score = useMemo(() => {
    return questions.reduce((s, qq) => s + (String(answers[qq.id] ?? '').trim().toLowerCase() === String(qq.answer ?? '').trim().toLowerCase() ? 1 : 0), 0);
  }, [answers, questions]);

  return (
    <main>
      <div className="card">
        <h2 className="text-brand-700 dark:text-brand-300 text-xl font-semibold border-b-4 border-brand-600 pb-2">Quiz: {topic}</h2>
        {!done ? (
          <div className="mt-4">
            <div className="text-gray-800 dark:text-gray-100 font-medium">{q.prompt}</div>
            {q.type === 'mcq' && (
              <ul className="mt-3 space-y-2">
                {q.choices?.map(c => (
                  <li key={c}>
                    <label className="flex items-center gap-2 text-sm">
                      <input type="radio" name={q.id} value={c} onChange={e => setAnswer(e.target.value)} />
                      <span>{c}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {q.type === 'short' && (
              <input className="mt-3 w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm" placeholder="Your answer" onChange={e => setAnswer(e.target.value)} />
            )}
            <button className="mt-4 px-3 py-1.5 rounded-md bg-white text-brand-700 dark:bg-neutral-800 dark:text-brand-300 font-semibold shadow" onClick={next}>Next</button>
          </div>
        ) : (
          <div className="mt-4">
            <div className="text-gray-800 dark:text-gray-100">Score: {score} / {questions.length}</div>
            <ul className="mt-3 space-y-2 text-sm">
              {questions.map(qq => (
                <li key={qq.id} className="bg-gray-50 dark:bg-neutral-900 p-3 rounded border border-neutral-200 dark:border-neutral-800">
                  <div className="font-medium">{qq.prompt}</div>
                  <div>Your answer: <span className="font-mono">{answers[qq.id] ?? '—'}</span></div>
                  {qq.answer && <div>Correct: <span className="font-mono">{String(qq.answer)}</span></div>}
                  {qq.explanation && <div className="text-gray-600 dark:text-gray-300">Explanation: {qq.explanation}</div>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}



