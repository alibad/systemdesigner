'use client';

/**
 * Lightweight diagnostics collector for the feedback widget.
 *
 * Monkey-patches `console` and `window.fetch` to buffer recent entries in ring
 * buffers, and exposes browser metadata on demand. Must be initialized early —
 * call `initDiagnostics()` in a root-level client component so logs are captured
 * from page load. Idempotent: safe to call more than once.
 */

export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: string;
}

export interface NetworkEntry {
  method: string;
  url: string;
  status: number;
  duration: number;
  timestamp: string;
}

export interface BrowserMetadata {
  url: string;
  userAgent: string;
  viewport: string;
  screen: string;
  devicePixelRatio: number;
  language: string;
  platform: string;
  cookiesEnabled: boolean;
  onLine: boolean;
  connection?: string;
}

const MAX_CONSOLE = 100;
const MAX_NETWORK = 50;

let consoleLogs: ConsoleEntry[] = [];
let networkLogs: NetworkEntry[] = [];
let initialized = false;

export function initDiagnostics(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // --- Console capture ---
  const levels = ['log', 'warn', 'error', 'info'] as const;
  const original: Record<string, (...args: unknown[]) => void> = {};
  for (const level of levels) {
    // eslint-disable-next-line no-console
    original[level] = console[level].bind(console);
    // eslint-disable-next-line no-console
    console[level] = (...args: unknown[]) => {
      try {
        consoleLogs.push({
          level,
          message: args
            .map((a) => (typeof a === 'string' ? a : safeStringify(a)))
            .join(' '),
          timestamp: new Date().toISOString(),
        });
        if (consoleLogs.length > MAX_CONSOLE) {
          consoleLogs = consoleLogs.slice(-MAX_CONSOLE);
        }
      } catch {
        /* never let diagnostics break logging */
      }
      original[level](...args);
    };
  }

  // --- Network (fetch) capture ---
  if (typeof window.fetch === 'function') {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const started =
        typeof performance !== 'undefined' ? performance.now() : 0;
      const [input, init] = args;
      const method =
        init?.method ||
        (typeof input === 'object' && 'method' in input
          ? (input as Request).method
          : 'GET');
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url;
      try {
        const res = await originalFetch(...args);
        record(method, url, res.status, started);
        return res;
      } catch (err) {
        record(method, url, 0, started);
        throw err;
      }
    };
  }
}

function record(method: string, url: string, status: number, started: number) {
  try {
    const duration =
      typeof performance !== 'undefined'
        ? Math.round(performance.now() - started)
        : 0;
    networkLogs.push({
      method: (method || 'GET').toUpperCase(),
      url: url.slice(0, 200),
      status,
      duration,
      timestamp: new Date().toISOString(),
    });
    if (networkLogs.length > MAX_NETWORK) {
      networkLogs = networkLogs.slice(-MAX_NETWORK);
    }
  } catch {
    /* ignore */
  }
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function getConsoleLogs(): ConsoleEntry[] {
  return consoleLogs;
}

export function getNetworkLogs(): NetworkEntry[] {
  return networkLogs;
}

export function getBrowserMetadata(): BrowserMetadata {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; rtt?: number };
  };
  const c = nav.connection;
  return {
    url: window.location.href,
    userAgent: navigator.userAgent,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    screen: `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}x`,
    devicePixelRatio: window.devicePixelRatio,
    language: navigator.language,
    platform: navigator.platform,
    cookiesEnabled: navigator.cookieEnabled,
    onLine: navigator.onLine,
    connection: c
      ? `${c.effectiveType ?? '?'}, ${c.downlink ?? '?'}Mbps, ${c.rtt ?? '?'}ms RTT`
      : undefined,
  };
}

/** Capture the page HTML for the requested scope. */
export function capturePageHtml(
  scope: 'full' | 'viewport' | 'selections',
  selectors: string[] = []
): string {
  if (typeof document === 'undefined') return '';
  if (scope === 'full') {
    return document.documentElement.outerHTML;
  }
  if (scope === 'selections') {
    const parts: string[] = [];
    for (const sel of selectors) {
      try {
        const el = document.querySelector(sel);
        if (el) parts.push(el.outerHTML);
      } catch {
        /* invalid selector — skip */
      }
    }
    return parts.join('\n\n<!-- ---- -->\n\n');
  }
  // viewport: elements intersecting the current viewport
  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const parts: string[] = [];
  document.body.querySelectorAll('*').forEach((el) => {
    const r = (el as HTMLElement).getBoundingClientRect();
    if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && r.width && r.height) {
      // Only top-level visible blocks to avoid duplication noise
      if ((el as HTMLElement).children.length <= 30) parts.push((el as HTMLElement).outerHTML);
    }
  });
  return parts.slice(0, 50).join('\n\n');
}
