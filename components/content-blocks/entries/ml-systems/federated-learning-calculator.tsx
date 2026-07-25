'use client';

import { useMemo, useState } from 'react';
import {
  Activity,
  Clock3,
  CloudCog,
  Database,
  Network,
  ShieldCheck,
  TriangleAlert,
  Upload,
  Users,
  Wifi,
} from 'lucide-react';

import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type FleetMode = 'cross-device' | 'cross-silo';

interface FleetProfile {
  id: FleetMode;
  label: string;
  detail: string;
  eligibleClients: number;
  invitations: number;
  availabilityPct: number;
  dropoutPct: number;
  modelMiB: number;
  uplinkMbps: number;
  localMinutes: number;
}

const BLOCK_ID = 'ml-systems/federated-learning-calculator';
const UPDATE_SIZE_RATIO = 0.35;
const COORDINATION_SECONDS = 35;

const profiles: FleetProfile[] = [
  {
    id: 'cross-device',
    label: 'Cross-device fleet',
    detail: 'Large, intermittently available phones or edge devices.',
    eligibleClients: 100_000,
    invitations: 500,
    availabilityPct: 64,
    dropoutPct: 18,
    modelMiB: 32,
    uplinkMbps: 8,
    localMinutes: 4,
  },
  {
    id: 'cross-silo',
    label: 'Cross-silo consortium',
    detail: 'A small set of organizations with managed compute and stable links.',
    eligibleClients: 80,
    invitations: 24,
    availabilityPct: 96,
    dropoutPct: 4,
    modelMiB: 128,
    uplinkMbps: 80,
    localMinutes: 18,
  },
];

export default function FederatedLearningCalculator() {
  const [mode, setMode] = useState<FleetMode>('cross-device');
  const [invitations, setInvitations] = useState(500);
  const [availabilityPct, setAvailabilityPct] = useState(64);
  const [dropoutPct, setDropoutPct] = useState(18);
  const [quorumPct, setQuorumPct] = useState(72);
  const [modelMiB, setModelMiB] = useState(32);
  const [localMinutes, setLocalMinutes] = useState(4);

  const profile = profiles.find((item) => item.id === mode) ?? profiles[0];
  const result = useMemo(() => {
    const accepted = Math.min(
      profile.eligibleClients,
      Math.round(invitations * (availabilityPct / 100)),
    );
    const survivors = Math.round(accepted * (1 - dropoutPct / 100));
    const requiredSurvivors = Math.ceil(accepted * (quorumPct / 100));
    const survivorMargin = survivors - requiredSurvivors;
    const updateMiB = modelMiB * UPDATE_SIZE_RATIO;
    const transferGiB = (accepted * modelMiB + survivors * updateMiB) / 1024;
    const downloadSeconds = (modelMiB * 8) / (profile.uplinkMbps * 4);
    const uploadSeconds = (updateMiB * 8) / profile.uplinkMbps;
    const roundMinutes = localMinutes + (downloadSeconds + uploadSeconds + COORDINATION_SECONDS) / 60;
    const participationRate = survivors / profile.eligibleClients;
    const healthy = survivorMargin >= 0;

    return {
      accepted,
      healthy,
      participationRate,
      requiredSurvivors,
      roundMinutes,
      survivorMargin,
      survivors,
      transferGiB,
      updateMiB,
    };
  }, [availabilityPct, dropoutPct, invitations, localMinutes, modelMiB, profile, quorumPct]);

  const applyProfile = (nextMode: FleetMode) => {
    const next = profiles.find((item) => item.id === nextMode) ?? profiles[0];
    setMode(next.id);
    setInvitations(next.invitations);
    setAvailabilityPct(next.availabilityPct);
    setDropoutPct(next.dropoutPct);
    setModelMiB(next.modelMiB);
    setLocalMinutes(next.localMinutes);
    setQuorumPct(next.id === 'cross-device' ? 72 : 80);
  };

  const reset = () => applyProfile('cross-device');
  const invitationMax = mode === 'cross-device' ? 2_000 : 80;
  const invitationMin = mode === 'cross-device' ? 50 : 4;
  const invitationStep = mode === 'cross-device' ? 50 : 2;

  return (
    <div data-content-block={BLOCK_ID}>
      <LearningLab>
        <LearningLabHeader
          eyebrow="Round viability lab"
          title="Can enough clients finish the round?"
          description="Shape a cross-device or cross-silo round. Availability and dropout determine the secure-aggregation quorum; model size and link speed determine the communication envelope."
          icon={Network}
          accent="cyan"
          onReset={reset}
        />
        <LearningLabBody
          controls={(
            <div className="space-y-7">
              <fieldset>
                <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                  Federation mode
                </legend>
                <div className="mt-3 grid gap-2">
                  {profiles.map((item) => (
                    <LabChoice
                      key={item.id}
                      selected={mode === item.id}
                      label={item.label}
                      detail={item.detail}
                      icon={item.id === 'cross-device' ? Wifi : CloudCog}
                      accent={item.id === 'cross-device' ? 'cyan' : 'violet'}
                      onClick={() => applyProfile(item.id)}
                    />
                  ))}
                </div>
              </fieldset>

              <LabRange
                label="Clients invited"
                value={invitations}
                output={invitations.toLocaleString()}
                min={invitationMin}
                max={invitationMax}
                step={invitationStep}
                accent="blue"
                lowLabel="Small cohort"
                highLabel="More coverage"
                onChange={setInvitations}
              />
              <LabRange
                label="Available now"
                value={availabilityPct}
                output={`${availabilityPct}%`}
                min={20}
                max={100}
                step={2}
                accent="emerald"
                lowLabel="Intermittent"
                highLabel="Reliable"
                onChange={setAvailabilityPct}
              />
              <LabRange
                label="Drop out after accepting"
                value={dropoutPct}
                output={`${dropoutPct}%`}
                min={0}
                max={50}
                step={1}
                accent="rose"
                lowLabel="Stable round"
                highLabel="High churn"
                onChange={setDropoutPct}
              />
              <LabRange
                label="Survivor quorum"
                value={quorumPct}
                output={`${quorumPct}%`}
                min={50}
                max={95}
                step={1}
                accent="violet"
                lowLabel="Tolerates loss"
                highLabel="Larger anonymity set"
                onChange={setQuorumPct}
              />
              <LabRange
                label="Global model payload"
                value={modelMiB}
                output={`${modelMiB} MiB`}
                min={8}
                max={256}
                step={8}
                accent="amber"
                lowLabel="Compact model"
                highLabel="Heavy transfer"
                onChange={setModelMiB}
              />
              <LabRange
                label="Local training time"
                value={localMinutes}
                output={`${localMinutes} min`}
                min={1}
                max={30}
                step={1}
                accent="cyan"
                lowLabel="Brief local work"
                highLabel="More client drift"
                onChange={setLocalMinutes}
              />
            </div>
          )}
        >
          <div className="space-y-6">
            <div className={`rounded-md border p-5 ${result.healthy ? healthyClass : warningClass}`}>
              <div className="flex items-start gap-3">
                {result.healthy ? (
                  <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div>
                  <p className="text-xs font-semibold uppercase opacity-75">Round verdict</p>
                  <h4 className="mt-1 text-xl font-semibold">
                    {result.healthy ? 'The expected cohort clears quorum' : 'Secure aggregation is expected to abort'}
                  </h4>
                  <p className="mt-2 text-sm leading-6 opacity-80">
                    {result.healthy
                      ? `${result.survivorMargin} clients remain above the modeled survivor threshold. Keep a timeout and retry policy because the estimate is not a guarantee.`
                      : `${Math.abs(result.survivorMargin)} more completed updates are needed. Invite more eligible clients, lower dropout, or use a protocol threshold justified by the threat model.`}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <LabMetric
                label="Accepted"
                value={result.accepted.toLocaleString()}
                detail={`${availabilityPct}% of invitations`}
                icon={Users}
                tone="blue"
              />
              <LabMetric
                label="Expected survivors"
                value={result.survivors.toLocaleString()}
                detail={`${result.requiredSurvivors.toLocaleString()} required for quorum`}
                icon={Activity}
                tone={result.healthy ? 'emerald' : 'rose'}
              />
              <LabMetric
                label="Transfer per round"
                value={`${result.transferGiB.toFixed(1)} GiB`}
                detail={`${result.updateMiB.toFixed(1)} MiB compressed update per survivor`}
                icon={Upload}
                tone="violet"
              />
              <LabMetric
                label="Round wall time"
                value={`${result.roundMinutes.toFixed(1)} min`}
                detail="Local work plus modeled transfer and coordination"
                icon={Clock3}
                tone="amber"
              />
            </div>

            <div className="rounded-md border border-neutral-200 bg-neutral-50 p-5 dark:border-neutral-800 dark:bg-neutral-900/60">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                Expected round path
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <StageCard
                  icon={Database}
                  label="Invite"
                  value={invitations.toLocaleString()}
                  detail={`from ${profile.eligibleClients.toLocaleString()} eligible clients`}
                />
                <StageCard
                  icon={Wifi}
                  label="Accept"
                  value={result.accepted.toLocaleString()}
                  detail="download the current model and round contract"
                />
                <StageCard
                  icon={Upload}
                  label="Contribute"
                  value={result.survivors.toLocaleString()}
                  detail={`${(result.participationRate * 100).toFixed(2)}% of the eligible fleet`}
                />
              </div>
            </div>

            <p className="text-xs leading-5 text-neutral-500 dark:text-neutral-400">
              Planning assumptions: the update is 35% of model size, downlink is four times uplink,
              and coordination adds 35 seconds. Real rounds are gated by tail clients, cryptographic
              setup, server aggregation, retries, energy policy, and regional network conditions.
            </p>
          </div>
        </LearningLabBody>
      </LearningLab>
    </div>
  );
}

function StageCard({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
        <Icon aria-hidden="true" className="h-4 w-4" />
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold tabular-nums text-neutral-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}

const healthyClass =
  'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50';
const warningClass =
  'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50';
