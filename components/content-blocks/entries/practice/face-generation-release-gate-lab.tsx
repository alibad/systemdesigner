'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, FileCheck2, Fingerprint, ScanSearch, ShieldAlert, ShieldCheck, UserRoundCheck, XCircle } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ConsentId = 'verified' | 'ambiguous' | 'missing';
type SafetyId = 'pass' | 'review' | 'block';
type Disposition = 'release' | 'review' | 'hold';

type ConsentState = {
  id: ConsentId;
  label: string;
  detail: string;
};

type SafetyState = {
  id: SafetyId;
  label: string;
  detail: string;
};

const consentStates: ConsentState[] = [
  {
    id: 'verified',
    label: 'Verified consent',
    detail: 'A scoped, revocable record links the requester, subject, use, and retention choice.',
  },
  {
    id: 'ambiguous',
    label: 'Ambiguous authority',
    detail: 'The upload may be legitimate, but the requester or permitted use cannot be established automatically.',
  },
  {
    id: 'missing',
    label: 'No consent evidence',
    detail: 'The service has no sufficient authorization to create or publish a reference-based likeness.',
  },
];

const safetyStates: SafetyState[] = [
  {
    id: 'pass',
    label: 'Output policy passes',
    detail: 'Pixel classifiers and request policy show no release-level violation.',
  },
  {
    id: 'review',
    label: 'Output policy uncertain',
    detail: 'The candidate needs trained review because the model evidence is borderline.',
  },
  {
    id: 'block',
    label: 'Output policy blocks',
    detail: 'A hard safety or deceptive-impersonation rule prohibits release.',
  },
];

export default function FaceGenerationReleaseGateLab() {
  const [consentId, setConsentId] = useState<ConsentId>('verified');
  const [similarity, setSimilarity] = useState(92);
  const [safetyId, setSafetyId] = useState<SafetyId>('pass');
  const [provenanceReady, setProvenanceReady] = useState(true);

  const model = useMemo(() => {
    const consent = consentStates.find((item) => item.id === consentId) ?? consentStates[0];
    const safety = safetyStates.find((item) => item.id === safetyId) ?? safetyStates[0];
    const identityPass = similarity >= 88;
    const consentPass = consent.id === 'verified';
    const safetyPass = safety.id === 'pass';
    const hardStop = consent.id === 'missing' || safety.id === 'block';
    const release = consentPass && identityPass && safetyPass && provenanceReady;
    const disposition: Disposition = hardStop ? 'hold' : release ? 'release' : 'review';

    return { consent, safety, consentPass, identityPass, safetyPass, hardStop, disposition };
  }, [consentId, provenanceReady, safetyId, similarity]);

  const reset = () => {
    setConsentId('verified');
    setSimilarity(92);
    setSafetyId('pass');
    setProvenanceReady(true);
  };

  const decision =
    model.disposition === 'release'
      ? {
          title: 'Release with an auditable manifest',
          detail: 'All independent gates pass. Publish an immutable asset linked to the consent record, model version, policy version, score report, and provenance ID.',
          tone: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40',
          icon: CheckCircle2,
        }
      : model.disposition === 'review'
        ? {
            title: 'Quarantine for review or better evidence',
            detail: 'At least one non-hard gate is uncertain. Keep the candidate inaccessible, request clearer input or authority evidence, or route it to trained review.',
            tone: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40',
            icon: CircleAlert,
          }
        : {
            title: 'Hold without publication',
            detail: 'Missing consent evidence or a hard output-policy violation fails closed. Image quality and similarity cannot authorize an unsafe likeness release.',
            tone: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40',
            icon: XCircle,
          };
  const DecisionIcon = decision.icon;

  const gates = [
    { label: 'Consent and authority', passed: model.consentPass, hard: model.consent.id === 'missing' },
    { label: 'Identity similarity >= 88', passed: model.identityPass, hard: false },
    { label: 'Output safety policy', passed: model.safetyPass, hard: model.safety.id === 'block' },
    { label: 'Provenance recorded', passed: provenanceReady, hard: false },
  ];

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Consent and release lab"
        title="Decide whether a generated likeness can leave quarantine"
        description="Change authorization, identity evidence, output safety, and provenance. The release state changes only when every independent condition is satisfied."
        icon={ShieldCheck}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inspect consent evidence
              </legend>
              <div className="mt-3 space-y-2">
                {consentStates.map((consent) => (
                  <LabChoice
                    key={consent.id}
                    selected={consent.id === consentId}
                    label={consent.label}
                    detail={consent.detail}
                    icon={UserRoundCheck}
                    accent={consent.id === 'verified' ? 'emerald' : consent.id === 'ambiguous' ? 'amber' : 'rose'}
                    onClick={() => setConsentId(consent.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Reference-to-output similarity"
              value={similarity}
              output={`${similarity}/100`}
              min={70}
              max={99}
              step={1}
              accent="cyan"
              lowLabel="Weak likeness proof"
              highLabel="Strong likeness proof"
              onChange={setSimilarity}
            />

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Inspect output safety
              </legend>
              <div className="mt-3 space-y-2">
                {safetyStates.map((safety) => (
                  <LabChoice
                    key={safety.id}
                    selected={safety.id === safetyId}
                    label={safety.label}
                    detail={safety.detail}
                    icon={ShieldAlert}
                    accent={safety.id === 'pass' ? 'emerald' : safety.id === 'review' ? 'amber' : 'rose'}
                    onClick={() => setSafetyId(safety.id)}
                  />
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-start gap-3 rounded-md border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-800 dark:bg-neutral-950">
              <input
                type="checkbox"
                checked={provenanceReady}
                onChange={(event) => setProvenanceReady(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
              />
              <span>
                <span className="block font-semibold text-neutral-950 dark:text-white">Provenance manifest is durable</span>
                <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                  The asset can be linked to its model, policy, threshold, evidence, and disposition.
                </span>
              </span>
            </label>
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Consent"
            value={model.consentPass ? 'Verified' : model.consent.id === 'missing' ? 'Missing' : 'Ambiguous'}
            detail={model.consentPass ? 'Authorized release evidence' : 'Cannot automatically authorize release'}
            icon={UserRoundCheck}
            tone={model.consentPass ? 'emerald' : model.consent.id === 'missing' ? 'rose' : 'amber'}
          />
          <LabMetric
            label="Identity similarity"
            value={`${similarity}/100`}
            detail="Automatic threshold: 88"
            icon={Fingerprint}
            tone={model.identityPass ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Output safety"
            value={model.safety.id === 'pass' ? 'Pass' : model.safety.id === 'review' ? 'Review' : 'Block'}
            detail="Pixel policy is independent of prompt intent"
            icon={ScanSearch}
            tone={model.safetyPass ? 'emerald' : model.safety.id === 'block' ? 'rose' : 'amber'}
          />
          <LabMetric
            label="Provenance"
            value={provenanceReady ? 'Recorded' : 'Missing'}
            detail="Required to audit a released asset"
            icon={FileCheck2}
            tone={provenanceReady ? 'emerald' : 'amber'}
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {gates.map((gate) => (
            <div
              key={gate.label}
              className={`flex items-center gap-3 rounded-md border p-3 text-sm font-semibold ${
                gate.passed
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                  : gate.hard
                    ? 'border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100'
                    : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100'
              }`}
            >
              {gate.passed ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />}
              {gate.label}
            </div>
          ))}
        </div>

        <div className={`mt-5 rounded-md border p-5 ${decision.tone}`} aria-live="polite">
          <div className="flex items-start gap-3">
            <DecisionIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase opacity-70">Release disposition</p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{decision.title}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{decision.detail}</p>
            </div>
          </div>
        </div>

        <p className="mt-5 flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
          A threshold is a calibrated operating policy, not a promise that one score proves authorization. Re-evaluate it across representative slices and keep hard consent or safety stops independent.
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
