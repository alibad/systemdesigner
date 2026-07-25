'use client';

import { useMemo, useState } from 'react';
import { Compass, Disc3, ListMusic, Sparkles, Target } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '../../learning/LearningLab';

type Moment = 'commute' | 'focus' | 'wind-down';

type Track = {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  familiar: number;
  context: Record<Moment, number>;
  discovery: number;
  eligible: boolean;
};

const moments: Array<{ id: Moment; label: string; detail: string }> = [
  { id: 'commute', label: 'Morning commute', detail: 'Energy and continuity matter.' },
  { id: 'focus', label: 'Deep focus', detail: 'Low disruption and tonal consistency matter.' },
  { id: 'wind-down', label: 'Wind down', detail: 'A calmer, less familiar direction can work.' },
];

const tracks: Track[] = [
  { id: 'orbit', title: 'Orbit Lines', artist: 'North Array', artistId: 'north-array', familiar: 93, context: { commute: 89, focus: 68, 'wind-down': 54 }, discovery: 10, eligible: true },
  { id: 'platform', title: 'Platform Light', artist: 'North Array', artistId: 'north-array', familiar: 88, context: { commute: 85, focus: 61, 'wind-down': 52 }, discovery: 15, eligible: true },
  { id: 'stillwater', title: 'Stillwater', artist: 'Luma Field', artistId: 'luma-field', familiar: 72, context: { commute: 54, focus: 91, 'wind-down': 84 }, discovery: 42, eligible: true },
  { id: 'paper', title: 'Paper Satellites', artist: 'Luma Field', artistId: 'luma-field', familiar: 63, context: { commute: 48, focus: 86, 'wind-down': 79 }, discovery: 55, eligible: true },
  { id: 'lantern', title: 'Lantern Hours', artist: 'Kite Harbor', artistId: 'kite-harbor', familiar: 37, context: { commute: 74, focus: 73, 'wind-down': 67 }, discovery: 86, eligible: true },
  { id: 'low-tide', title: 'Low Tide Signal', artist: 'Mira Vale', artistId: 'mira-vale', familiar: 28, context: { commute: 49, focus: 79, 'wind-down': 92 }, discovery: 94, eligible: true },
  { id: 'catalog', title: 'Catalog Echo', artist: 'Archive Signal', artistId: 'archive-signal', familiar: 81, context: { commute: 77, focus: 65, 'wind-down': 58 }, discovery: 21, eligible: false },
];

export default function SpotifyRecommendationsSlateLab() {
  const [moment, setMoment] = useState<Moment>('commute');
  const [discoveryShare, setDiscoveryShare] = useState(15);
  const [artistCap, setArtistCap] = useState(1);

  const result = useMemo(() => {
    const scored = tracks
      .filter((track) => track.eligible)
      .map((track) => ({
        ...track,
        score: track.familiar * 0.28 + track.context[moment] * 0.52 + track.discovery * (discoveryShare / 100) * 0.4,
      }))
      .sort((a, b) => b.score - a.score);

    const artistCounts = new Map<string, number>();
    const slate: typeof scored = [];
    for (const track of scored) {
      const count = artistCounts.get(track.artistId) ?? 0;
      if (count >= artistCap) continue;
      slate.push(track);
      artistCounts.set(track.artistId, count + 1);
      if (slate.length === 4) break;
    }

    const averageContext = Math.round(slate.reduce((sum, track) => sum + track.context[moment], 0) / slate.length);
    const discoveryCount = slate.filter((track) => track.discovery >= 70).length;
    const artistCount = new Set(slate.map((track) => track.artistId)).size;
    const skipRisk = Math.max(4, 29 - Math.round(averageContext * 0.19) + discoveryCount * 4);
    const explanation = discoveryShare >= 30 && discoveryCount >= 2
      ? 'The slate gives two unfamiliar tracks meaningful exposure. Watch rapid skips: discovery is working only if relevance remains credible.'
      : artistCap > 1
        ? 'The familiar artist can occupy multiple positions. This is efficient for short-term confidence but makes the slate less varied.'
        : 'The slate keeps one position per artist while preserving the strongest fit for the selected listening moment.';

    return { slate, averageContext, discoveryCount, artistCount, skipRisk, explanation };
  }, [artistCap, discoveryShare, moment]);

  const reset = () => {
    setMoment('commute');
    setDiscoveryShare(15);
    setArtistCap(1);
  };

  const controls = (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Listening moment</legend>
        <div className="mt-3 space-y-2">
          {moments.map((item) => (
            <LabChoice key={item.id} selected={moment === item.id} label={item.label} detail={item.detail} icon={Compass} accent="blue" onClick={() => setMoment(item.id)} />
          ))}
        </div>
      </fieldset>
      <LabRange label="Discovery allocation" value={discoveryShare} output={`${discoveryShare}%`} min={0} max={40} step={5} accent="violet" lowLabel="Familiar" highLabel="More new music" onChange={setDiscoveryShare} />
      <LabRange label="Artist cap" value={artistCap} output={`${artistCap} track${artistCap === 1 ? '' : 's'} / artist`} min={1} max={2} accent="emerald" lowLabel="More variety" highLabel="More repetition" onChange={setArtistCap} />
    </div>
  );

  return (
    <LearningLab>
      <LearningLabHeader eyebrow="Slate policy lab" title="Turn item scores into a listening session" description="Choose a moment, discovery budget, and artist cap. The returned slate changes because the policy is part of the recommendation decision." icon={ListMusic} accent="violet" onReset={reset} />
      <LearningLabBody controls={controls}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric label="Context fit" value={`${result.averageContext}/100`} detail="Average fit for this moment" icon={Target} tone="blue" />
          <LabMetric label="Discovery tracks" value={`${result.discoveryCount}/4`} detail="High-novelty tracks in slate" icon={Sparkles} tone="violet" />
          <LabMetric label="Artists" value={`${result.artistCount}/4`} detail="Unique artists represented" icon={Disc3} tone="emerald" />
          <LabMetric label="Rapid-skip risk" value={`${result.skipRisk}%`} detail="Illustrative policy trade-off" icon={Compass} tone={result.skipRisk > 16 ? 'amber' : 'neutral'} />
        </div>
        <div className="mt-6 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
          {result.slate.map((track, index) => (
            <div key={track.id} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-neutral-200 px-4 py-3 last:border-b-0 dark:border-neutral-800">
              <span className="text-sm font-semibold tabular-nums text-neutral-500 dark:text-neutral-400">{index + 1}</span>
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{track.title}</p><p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{track.artist}</p></div>
              <span className="text-right text-xs font-semibold tabular-nums text-neutral-600 dark:text-neutral-300">{Math.round(track.score)}</span>
            </div>
          ))}
        </div>
        <p className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">{result.explanation}</p>
      </LearningLabBody>
    </LearningLab>
  );
}
