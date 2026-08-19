import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { grade } from '@/lib/challenges/grade';
import { getRubric } from '@/lib/rubrics';
import type { GradeRequest, GradeResult } from '@/lib/challenges/types';

// Grading reads the filesystem-bundled rubric registry and may call OpenAI — Node runtime.
export const runtime = 'nodejs';

/**
 * POST /api/grade — grade a learner artifact against a server-side rubric.
 *
 * The score and pass/fail are 100% deterministic (lib/challenges/grade.ts). When an
 * OpenAI key is present we add a short, NON-scoring coaching note on top. The LLM can
 * never change the score, so progression never depends on a flaky/expensive call.
 */
export async function POST(request: NextRequest) {
  let body: GradeRequest;
  try {
    body = (await request.json()) as GradeRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { challengeId, attempt = 1, records, answers, narration } = body || {};
  if (!challengeId) {
    return NextResponse.json({ error: 'Missing challengeId' }, { status: 400 });
  }

  const rubric = getRubric(challengeId);
  if (!rubric) {
    return NextResponse.json({ error: `Unknown challenge: ${challengeId}` }, { status: 404 });
  }

  const startedAt = Date.now();
  const scored = grade(rubric, { records, answers });

  let feedback: string | undefined;
  // Optional coaching narrative — only for design challenges, only if a key is set,
  // and only if it can't break the response (deterministic score already computed).
  if (process.env.OPENAI_API_KEY && (rubric.kind === 'design' || rubric.kind === 'staged')) {
    try {
      feedback = await coach(rubric.prompt, narration, scored.perCriterion);
    } catch (err) {
      console.warn('[grade] coaching narrative failed (non-fatal):', err);
    }
  }

  const result: GradeResult = {
    challengeId,
    kind: rubric.kind,
    score: Number(scored.score.toFixed(3)),
    passed: scored.passed,
    xpWeight: rubric.xpWeight,
    perCriterion: scored.perCriterion,
    feedback,
    timeMs: Date.now() - startedAt,
    attempt,
  };

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function coach(
  prompt: string,
  narration: string | undefined,
  perCriterion: GradeResult['perCriterion']
): Promise<string> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_GRADER_MODEL || 'gpt-5.6-sol';

  const met = perCriterion.filter((c) => c.met).map((c) => c.label);
  const missing = perCriterion.filter((c) => !c.met).map((c) => `${c.label} — ${c.why}`);

  const system =
    'You are a FAANG system-design interviewer giving terse, specific coaching. ' +
    'You are given a rubric verdict that is already final — do NOT re-grade or assign a score. ' +
    'In 2-3 sentences, acknowledge what the candidate got right, then push on the single most ' +
    'important gap and the trade-off behind it. Never vague praise like "great design".';

  const user =
    `Challenge: ${prompt}\n\n` +
    (narration ? `Candidate's reasoning: ${narration}\n\n` : '') +
    `Already satisfied: ${met.join('; ') || 'none'}\n` +
    `Still missing: ${missing.join(' | ') || 'none'}\n\n` +
    'Give the coaching note.';

  const completion = await openai.chat.completions.create({
    model,
    // Coaching quality is the product here, so reasoning stays on.
    reasoning_effort: 'high',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    max_completion_tokens: 180,
  });

  return completion.choices[0]?.message?.content?.trim() || '';
}
