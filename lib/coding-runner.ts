import type { CodingStep } from "@/lib/learning-path";

export interface CodeTestResult {
  label: string;
  passed: boolean;
  actual: string;
  expected: string;
}
export interface CodeRunResult {
  results: CodeTestResult[];
  error?: string;
}

/** JSON-shaped values compare by content; object property order is irrelevant. */
export function codeValuesEqual(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (
    !actual ||
    !expected ||
    typeof actual !== "object" ||
    typeof expected !== "object"
  )
    return false;
  if (Array.isArray(actual) !== Array.isArray(expected)) return false;
  if (
    Array.isArray(actual) &&
    Array.isArray(expected) &&
    actual.length !== expected.length
  )
    return false;
  const left = Object.keys(actual),
    right = Object.keys(expected);
  return (
    left.length === right.length &&
    left.every(
      (key) =>
        Object.hasOwn(expected, key) &&
        codeValuesEqual(
          (actual as Record<string, unknown>)[key],
          (expected as Record<string, unknown>)[key],
        ),
    )
  );
}

// The worker runs inside an opaque-origin iframe. User code never runs in the app's
// window, cannot reach its storage, and inherits a CSP that blocks network access.
// A worker (rather than eval in the iframe) lets us terminate infinite loops.
const WORKER_SOURCE = `
const codeValuesEqual = ${codeValuesEqual.toString()};
self.onmessage = async ({ data }) => {
  try {
    const solve = new Function('"use strict";\\n' + data.code + '\\nreturn ' + data.functionName + ';')();
    if (typeof solve !== 'function') throw new Error('Define the requested function before running tests.');
    const results = [];
    for (const test of data.tests) {
      const input = structuredClone(test.args);
      const actual = await solve(...input);
      const unchanged = !data.preserveInputs || codeValuesEqual(input, test.args);
      results.push({ label: test.label, passed: unchanged && codeValuesEqual(actual, test.expected), actual: unchanged ? String(JSON.stringify(actual)) : 'Input arguments were changed.', expected: String(JSON.stringify(test.expected)) });
    }
    self.postMessage({ results });
  } catch (error) { self.postMessage({ results: [], error: String(error.message || error).slice(0, 500) }); }
};`;

const FRAME_SOURCE = `<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob:; worker-src blob:; connect-src 'none';"><script>
window.addEventListener('message', function(event) {
  if (event.source !== parent || event.data.type !== 'run-code') return;
  const request = event.data;
  const url = URL.createObjectURL(new Blob([${JSON.stringify(WORKER_SOURCE)}], { type: 'text/javascript' }));
  const worker = new Worker(url);
  const finish = function(result) { clearTimeout(timer); worker.terminate(); URL.revokeObjectURL(url); parent.postMessage({ type: 'code-result', id: request.id, result }, '*'); };
  const timer = setTimeout(() => finish({ results: [], error: 'Your code took too long. Check for an infinite loop and try again.' }), 2000);
  worker.onmessage = event => finish(event.data);
  worker.onerror = () => finish({ results: [], error: 'The code could not run. Check the syntax and try again.' });
  worker.postMessage(request);
}, { once: true });
</script>`;

export function runCode(
  code: string,
  step: CodingStep,
  signal?: AbortSignal,
): Promise<CodeRunResult> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({ results: [], error: "Run cancelled." });
      return;
    }
    const frame = document.createElement("iframe");
    const id = crypto.randomUUID();
    frame.hidden = true;
    frame.title = "Isolated coding exercise";
    frame.setAttribute("sandbox", "allow-scripts");
    frame.srcdoc = FRAME_SOURCE;
    const finish = (result: CodeRunResult) => {
      clearTimeout(timeout);
      window.removeEventListener("message", receive);
      signal?.removeEventListener("abort", cancel);
      frame.remove();
      resolve(result);
    };
    const receive = (event: MessageEvent) => {
      if (
        event.source !== frame.contentWindow ||
        event.data?.type !== "code-result" ||
        event.data.id !== id
      )
        return;
      const result = event.data.result;
      if (!result || !Array.isArray(result.results)) {
        finish({
          results: [],
          error: "Invalid test result. Please try again.",
        });
        return;
      }
      finish(result);
    };
    const cancel = () => finish({ results: [], error: "Run cancelled." });
    const timeout = window.setTimeout(
      () =>
        finish({
          results: [],
          error:
            "The runner did not respond. Please try again in a browser that supports Web Workers.",
        }),
      5_000,
    );
    window.addEventListener("message", receive);
    signal?.addEventListener("abort", cancel, { once: true });
    frame.onload = () =>
      frame.contentWindow?.postMessage(
        {
          type: "run-code",
          id,
          code,
          functionName: step.functionName,
          tests: step.tests,
          preserveInputs: step.preserveInputs,
        },
        "*",
      );
    document.body.appendChild(frame);
  });
}
