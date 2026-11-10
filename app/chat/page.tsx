"use client";
import { useState } from 'react';

type Message = { role: 'user' | 'assistant'; content: string };

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  const send = () => {
    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    const toSend = input.trim();
    setInput('');
    const canned = toSend
      ? 'This is a client‑only placeholder. The full AI coach will return once backend is enabled.'
      : 'Ask about latency, CDN, infra...';
    const assistantMsg: Message = { role: 'assistant', content: canned };
    setMessages(prev => [...prev, assistantMsg]);
  };

  return (
    <main>
      <div className="card">
        <h2 className="text-primary-600 text-xl font-semibold border-b-4 border-primary-600 pb-2">Ask AI</h2>
        <div className="mt-4 space-y-2 max-h-[60vh] overflow-auto bg-gray-50 dark:bg-neutral-900 p-3 rounded border">
          {messages.map((m, i) => (
            <div key={`${m.role}-${i}-${m.content.slice(0, 8)}`} className={`text-sm ${m.role === 'assistant' ? 'text-gray-800 dark:text-neutral-100' : 'text-gray-700 dark:text-neutral-300'}`}>
              <span className="font-semibold mr-2">{m.role === 'assistant' ? 'AI' : 'You'}:</span>
              <span>{m.content}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="flex-1 rounded-md border bg-white dark:bg-neutral-950 px-3 py-2 text-sm" placeholder="Ask about latency, CDN, infra..." value={input} onChange={e => setInput(e.target.value)} />
          <button className="px-3 py-2 rounded-md bg-white text-brand-600 dark:bg-neutral-800 dark:text-brand-300 font-semibold shadow" onClick={send}>Send</button>
        </div>
      </div>
    </main>
  );
}


