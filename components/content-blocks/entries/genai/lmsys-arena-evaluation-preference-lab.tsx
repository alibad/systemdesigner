'use client';

import { useMemo, useState } from 'react';
import { BarChart3, CircleDot, Scale, Trophy } from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type TiePolicy = 'split' | 'exclude';

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;

export default function LmsysArenaEvaluationPreferenceLab() {
  const [winsA, setWinsA] = useState(190);
  const [winsB, setWinsB] = useState(150);
  const [ties, setTies] = useState(60);
  const [tiePolicy, setTiePolicy] = useState<TiePolicy>('split');

  const model = useMemo(() => {
    const recordedVotes = winsA + winsB + ties;
    const effectiveVotes = winsA + winsB + (tiePolicy === 'split' ? ties : 0);
    const scoreA = winsA + (tiePolicy === 'split' ? ties / 2 : 0);
    const preferenceA = scoreA / effectiveVotes;
    const standardError = Math.sqrt((preferenceA * (1 - preferenceA)) / effectiveVotes);
    const margin = 1.96 * standardError;
    const lower = Math.max(0, preferenceA - margin);
    const upper = Math.min(1, preferenceA + margin);
    const boundedPreference = Math.min(0.999, Math.max(0.001, preferenceA));
    const ratingGap = 400 * Math.log10(boundedPreference / (1 - boundedPreference));
    const decision = lower > 0.5 ? 'Evidence favors A' : upper < 0.5 ? 'Evidence favors B' : 'Result is unresolved';
    const summary =
      decision === 'Evidence favors A'
        ? 'The approximate interval stays above an even matchup. Treat this as relative evidence for this prompt and voter mix.'
        : decision === 'Evidence favors B'
          ? 'The approximate interval stays below an even matchup, so B has the supported preference lead in this sample.'
          : 'The interval crosses 50%. A rank order would hide material uncertainty, so collect more representative votes or report a tie band.';

    return {
      decision,
      effectiveVotes,
      lower,
      margin,
      preferenceA,
      ratingGap,
      recordedVotes,
      summary,
      upper,
    };
  }, [tiePolicy, ties, winsA, winsB]);

  const reset = () => {
    setWinsA(190);
    setWinsB(150);
    setTies(60);
    setTiePolicy('split');
  };

  const aShare = (winsA / model.recordedVotes) * 100;
  const tieShare = (ties / model.recordedVotes) * 100;
  const bShare = (winsB / model.recordedVotes) * 100;

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Preference aggregation lab"
        title="Turn pairwise votes into an honest estimate"
        description="Change the vote mix and tie policy. Watch the preference score, uncertainty interval, and rating gap move together."
        icon={Scale}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <LabRange
              label="Candidate A wins"
              value={winsA}
              output={winsA.toLocaleString()}
              min={10}
              max={400}
              step={5}
              accent="cyan"
              lowLabel="10"
              highLabel="400"
              onChange={setWinsA}
            />
            <LabRange
              label="Candidate B wins"
              value={winsB}
              output={winsB.toLocaleString()}
              min={10}
              max={400}
              step={5}
              accent="violet"
              lowLabel="10"
              highLabel="400"
              onChange={setWinsB}
            />
            <LabRange
              label="Ties"
              value={ties}
              output={ties.toLocaleString()}
              min={0}
              max={200}
              step={5}
              accent="amber"
              lowLabel="0"
              highLabel="200"
              onChange={setTies}
            />
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Tie policy
              </legend>
              <div className="mt-3 grid gap-2">
                <LabChoice
                  selected={tiePolicy === 'split'}
                  label="Split each tie"
                  detail="Give each candidate half a point and retain the vote in the estimate."
                  icon={CircleDot}
                  accent="amber"
                  onClick={() => setTiePolicy('split')}
                />
                <LabChoice
                  selected={tiePolicy === 'exclude'}
                  label="Exclude ties"
                  detail="Estimate only from decisive votes and report the smaller effective sample."
                  icon={CircleDot}
                  accent="amber"
                  onClick={() => setTiePolicy('exclude')}
                />
              </div>
            </fieldset>
          </div>
        }
      >
        <div className="min-h-[440px] min-w-0">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabMetric
              label="Candidate A score"
              value={percent(model.preferenceA)}
              detail={`From ${model.effectiveVotes.toLocaleString()} effective votes`}
              icon={Trophy}
              tone="cyan"
            />
            <LabMetric
              label="Approximate 95% interval"
              value={`${percent(model.lower)}-${percent(model.upper)}`}
              detail={`Sampling margin is about +/- ${percent(model.margin)}`}
              icon={BarChart3}
              tone="violet"
            />
            <LabMetric
              label="Elo-like rating gap"
              value={`${model.ratingGap >= 0 ? '+' : ''}${model.ratingGap.toFixed(0)}`}
              detail="A transformed pairwise score, not an absolute quality unit"
              tone="amber"
            />
            <LabMetric
              label="Recorded votes"
              value={model.recordedVotes.toLocaleString()}
              detail={tiePolicy === 'exclude' ? `${ties} ties are omitted from estimation` : 'Ties contribute half a point per model'}
              tone="neutral"
            />
          </div>

          <div className="mt-6" aria-label="Recorded vote distribution">
            <div className="flex items-center justify-between gap-4 text-sm font-semibold text-neutral-900 dark:text-white">
              <span>Recorded outcomes</span>
              <span className="tabular-nums">{model.recordedVotes} votes</span>
            </div>
            <div className="mt-3 flex h-10 w-full overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-700">
              <div
                className="flex items-center justify-center bg-cyan-500 text-xs font-semibold text-cyan-950"
                style={{ width: `${aShare}%` }}
                title={`Candidate A wins: ${winsA}`}
              >
                {aShare >= 14 ? `A ${aShare.toFixed(0)}%` : null}
              </div>
              <div
                className="flex items-center justify-center bg-amber-300 text-xs font-semibold text-amber-950"
                style={{ width: `${tieShare}%` }}
                title={`Ties: ${ties}`}
              >
                {tieShare >= 14 ? `Tie ${tieShare.toFixed(0)}%` : null}
              </div>
              <div
                className="flex items-center justify-center bg-violet-500 text-xs font-semibold text-white"
                style={{ width: `${bShare}%` }}
                title={`Candidate B wins: ${winsB}`}
              >
                {bShare >= 14 ? `B ${bShare.toFixed(0)}%` : null}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
              <span>A wins: {winsA}</span>
              <span>Ties: {ties}</span>
              <span>B wins: {winsB}</span>
            </div>
          </div>

          <div className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-sm font-semibold text-neutral-950 dark:text-white">{model.decision}</p>
            <p className="mt-2 text-sm leading-6 text-neutral-600 dark:text-neutral-300">{model.summary}</p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
