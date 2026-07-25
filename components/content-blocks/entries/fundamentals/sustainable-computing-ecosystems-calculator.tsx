'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  BatteryCharging,
  CircleAlert,
  CloudSun,
  Cpu,
  Factory,
  Gauge,
  Leaf,
  ShieldCheck,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

const BLOCK_ID = 'fundamentals/sustainable-computing-ecosystems-calculator';

const profiles = [
  { id: 'batch', label: 'Deferrable batch window', detail: 'A bounded analytics job can move in time while preserving its deadline.', energyKwh: 180, gridIntensity: 420, embodiedGrams: 22000, usefulUnits: 100000 },
  { id: 'api', label: 'Always-on API hour', detail: 'User traffic cannot simply move; efficiency and hardware utilization dominate.', energyKwh: 95, gridIntensity: 310, embodiedGrams: 18000, usefulUnits: 1500000 },
  { id: 'training', label: 'Model training run', detail: 'A large job can compare region, time, completion target, and hardware efficiency.', energyKwh: 1200, gridIntensity: 180, embodiedGrams: 90000, usefulUnits: 1 },
] as const;

export default function SustainableComputingEcosystemsCalculator() {
  const [profileId, setProfileId] = useState<(typeof profiles)[number]['id']>('batch');
  const [energyKwh, setEnergyKwh] = useState<number>(profiles[0].energyKwh);
  const [gridIntensity, setGridIntensity] = useState<number>(profiles[0].gridIntensity);
  const [embodiedGrams, setEmbodiedGrams] = useState<number>(profiles[0].embodiedGrams);
  const [usefulUnits, setUsefulUnits] = useState<number>(profiles[0].usefulUnits);
  const [baselineSci, setBaselineSci] = useState<number>(1.2);

  const model = useMemo(() => {
    const operationalGrams = energyKwh * gridIntensity;
    const totalGrams = operationalGrams + embodiedGrams;
    const sci = totalGrams / usefulUnits;
    const improvementPct = ((baselineSci - sci) / baselineSci) * 100;
    return {
      operationalGrams,
      totalGrams,
      sci,
      improvementPct,
      improved: improvementPct > 0,
      operationalShare: totalGrams === 0 ? 0 : operationalGrams / totalGrams,
    };
  }, [baselineSci, embodiedGrams, energyKwh, gridIntensity, usefulUnits]);

  const applyProfile = (id: (typeof profiles)[number]['id']) => {
    const profile = profiles.find((item) => item.id === id) ?? profiles[0];
    setProfileId(profile.id);
    setEnergyKwh(profile.energyKwh);
    setGridIntensity(profile.gridIntensity);
    setEmbodiedGrams(profile.embodiedGrams);
    setUsefulUnits(profile.usefulUnits);
    const initial = (profile.energyKwh * profile.gridIntensity + profile.embodiedGrams) / profile.usefulUnits;
    setBaselineSci(Number((initial * 1.25).toPrecision(3)));
  };

  const reset = () => applyProfile('batch');

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Software carbon intensity lab"
          title="Measure emissions per useful unit, not a decorative green score"
          description="Apply the SCI relationship (energy × grid intensity + allocated embodied emissions) ÷ functional units. Keep the boundary and baseline identical when comparing changes."
          icon={Leaf}
          accent="emerald"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Measurement boundary</p>
                <div className="mt-3 space-y-2">
                  {profiles.map((profile) => (
                    <LabChoice
                      key={profile.id}
                      selected={profile.id === profileId}
                      label={profile.label}
                      detail={profile.detail}
                      icon={Cpu}
                      accent="emerald"
                      onClick={() => applyProfile(profile.id)}
                    />
                  ))}
                </div>
              </div>
              <LabRange label="Energy in boundary" value={energyKwh} output={`${energyKwh.toLocaleString()} kWh`} min={1} max={2000} step={1} lowLabel="efficient" highLabel="energy intensive" accent="amber" onChange={setEnergyKwh} />
              <LabRange label="Grid carbon intensity" value={gridIntensity} output={`${gridIntensity} gCO2e/kWh`} min={20} max={800} step={10} lowLabel="lower carbon" highLabel="higher carbon" accent="rose" onChange={setGridIntensity} />
              <LabRange label="Allocated embodied emissions" value={embodiedGrams} output={`${embodiedGrams.toLocaleString()} gCO2e`} min={0} max={150000} step={1000} lowLabel="less hardware share" highLabel="more hardware share" accent="violet" onChange={setEmbodiedGrams} />
              <LabRange label="Useful functional units" value={usefulUnits} output={usefulUnits.toLocaleString()} min={1} max={2000000} step={profileId === 'training' ? 1 : 1000} lowLabel="less useful work" highLabel="more useful work" accent="blue" onChange={setUsefulUnits} />
              <LabRange label="Comparable baseline SCI" value={baselineSci} output={`${baselineSci.toFixed(3)} g/unit`} min={0.01} max={5} step={0.01} lowLabel="lower baseline" highLabel="higher baseline" accent="cyan" onChange={setBaselineSci} />
            </div>
          )}
        >
          <div className={`rounded-md border p-5 ${
            model.improved
              ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/35'
              : 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/35'
          }`}>
            <div className="flex items-start gap-3">
              {model.improved
                ? <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />}
              <div>
                <p className="text-xs font-semibold uppercase text-neutral-600 dark:text-neutral-300">Comparable outcome</p>
                <h4 className="mt-1 text-xl font-semibold text-neutral-950 dark:text-white">
                  {model.improved ? 'Carbon intensity is below the baseline' : 'This change does not beat the baseline'}
                </h4>
                <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                  Current SCI is {model.sci.toFixed(3)} gCO2e per functional unit, {Math.abs(model.improvementPct).toFixed(1)}% {model.improved ? 'lower' : 'higher'} than the selected baseline. The comparison is valid only if both measurements use the same boundary and unit.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <LabMetric label="Operational emissions" value={`${(model.operationalGrams / 1000).toFixed(1)} kgCO2e`} detail="energy multiplied by grid intensity" icon={CloudSun} tone="amber" />
            <LabMetric label="Embodied allocation" value={`${(embodiedGrams / 1000).toFixed(1)} kgCO2e`} detail="hardware manufacturing share in boundary" icon={Factory} tone="violet" />
            <LabMetric label="SCI" value={`${model.sci.toFixed(3)} g/unit`} detail="lower is better under the same functional unit" icon={Gauge} tone={model.improved ? 'emerald' : 'rose'} />
            <LabMetric label="Operational share" value={`${(model.operationalShare * 100).toFixed(0)}%`} detail="shows where this boundary is concentrated" icon={BatteryCharging} tone="blue" />
          </div>

          <div className="mt-5 rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300">
            <span className="inline-flex items-center gap-2 font-semibold text-neutral-950 dark:text-white"><Activity aria-hidden="true" className="h-4 w-4" />Constraint check</span>
            <p className="mt-2">A lower score is useful only when the system still meets its completion deadline, reliability target, data-residency rules, and user outcome. Record those guardrails beside the carbon measurement.</p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}
