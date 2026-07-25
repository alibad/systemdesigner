'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, CircleAlert, Fingerprint, ScanSearch, ShieldAlert, ShieldCheck, UserRoundCheck } from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ScenarioId = 'clear' | 'low-input' | 'lookalike' | 'impersonation';
type PolicyId = 'conservative' | 'standard' | 'strict-brand';
type Disposition = 'release' | 'review' | 'reject';

type Scenario = {
  id: ScenarioId;
  label: string;
  detail: string;
  consent: boolean;
  similarity: number;
  professional: number;
  editRisk: number;
  policyRisk: number;
};

type Policy = {
  id: PolicyId;
  label: string;
  detail: string;
  minimumProfessional: number;
  maximumEditRisk: number;
  maximumPolicyRisk: number;
};

const scenarios: Scenario[] = [
  {
    id: 'clear',
    label: 'Clear consented reference set',
    detail: 'Several well-lit, single-subject photos; the final changes lighting and background only.',
    consent: true,
    similarity: 92,
    professional: 91,
    editRisk: 8,
    policyRisk: 4,
  },
  {
    id: 'low-input',
    label: 'Low-quality input set',
    detail: 'One dim, heavily filtered selfie; generated framing looks polished but identity evidence is weak.',
    consent: true,
    similarity: 78,
    professional: 89,
    editRisk: 18,
    policyRisk: 5,
  },
  {
    id: 'lookalike',
    label: 'Potential lookalike result',
    detail: 'The output has good lighting but alters facial structure enough to create an ambiguous likeness match.',
    consent: true,
    similarity: 82,
    professional: 94,
    editRisk: 42,
    policyRisk: 12,
  },
  {
    id: 'impersonation',
    label: 'Deceptive impersonation request',
    detail: 'The requester claims consent but asks for a misleading professional identity and public-facing use.',
    consent: false,
    similarity: 90,
    professional: 88,
    editRisk: 35,
    policyRisk: 91,
  },
];

const policies: Policy[] = [
  {
    id: 'conservative',
    label: 'Conservative consumer',
    detail: 'Tighter quality and edit bounds for a broad public product.',
    minimumProfessional: 85,
    maximumEditRisk: 22,
    maximumPolicyRisk: 20,
  },
  {
    id: 'standard',
    label: 'Standard professional',
    detail: 'Normal headshot policy with review for uncertain evidence.',
    minimumProfessional: 80,
    maximumEditRisk: 30,
    maximumPolicyRisk: 25,
  },
  {
    id: 'strict-brand',
    label: 'Strict enterprise brand',
    detail: 'Strong composition standard, while consent and identity remain non-negotiable.',
    minimumProfessional: 90,
    maximumEditRisk: 20,
    maximumPolicyRisk: 15,
  },
];

export default function HeadshotGenerationReleaseGateLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('clear');
  const [policyId, setPolicyId] = useState<PolicyId>('standard');
  const [similarityThreshold, setSimilarityThreshold] = useState(86);

  const model = useMemo(() => {
    const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
    const policy = policies.find((item) => item.id === policyId) ?? policies[1];
    const identityPass = scenario.similarity >= similarityThreshold;
    const professionalPass = scenario.professional >= policy.minimumProfessional;
    const editPass = scenario.editRisk <= policy.maximumEditRisk;
    const policyPass = scenario.policyRisk <= policy.maximumPolicyRisk;
    const disposition: Disposition =
      !scenario.consent || scenario.policyRisk > policy.maximumPolicyRisk * 2
        ? 'reject'
        : identityPass && professionalPass && editPass && policyPass
          ? 'release'
          : 'review';

    return { scenario, policy, identityPass, professionalPass, editPass, policyPass, disposition };
  }, [policyId, scenarioId, similarityThreshold]);

  const reset = () => {
    setScenarioId('clear');
    setPolicyId('standard');
    setSimilarityThreshold(86);
  };

  const response =
    model.disposition === 'release'
      ? 'Release with an auditable manifest'
      : model.disposition === 'review'
        ? 'Hold for review or a better reference set'
        : 'Reject before publication';

  const explanation =
    model.disposition === 'release'
      ? 'All independent gates pass. The service can publish an immutable asset linked to the consent record, model version, preset, and score report.'
      : model.disposition === 'review'
        ? 'At least one bounded quality or faithfulness signal is uncertain. Keep the candidate in quarantine and request clearer inputs or route it to trained review.'
        : 'Consent or high policy risk fails closed. Rendering quality cannot make an unauthorized or deceptive likeness request safe to release.';

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Release decision lab"
        title="Choose evidence before releasing a likeness"
        description="Select an input scenario, a product policy, and an identity threshold. Each independent gate changes the visible disposition and the reason for it."
        icon={ShieldCheck}
        accent="emerald"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Inspect the job scenario
              </legend>
              <div className="mt-3 space-y-2">
                {scenarios.map((scenario) => (
                  <LabChoice
                    key={scenario.id}
                    selected={scenario.id === scenarioId}
                    label={scenario.label}
                    detail={scenario.detail}
                    icon={scenario.id === 'impersonation' ? ShieldAlert : UserRoundCheck}
                    accent={scenario.id === 'impersonation' ? 'rose' : scenario.id === 'lookalike' ? 'amber' : 'cyan'}
                    onClick={() => setScenarioId(scenario.id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Choose a release policy
              </legend>
              <div className="mt-3 space-y-2">
                {policies.map((policy) => (
                  <LabChoice
                    key={policy.id}
                    selected={policy.id === policyId}
                    label={policy.label}
                    detail={policy.detail}
                    icon={ShieldCheck}
                    accent={policy.id === 'strict-brand' ? 'violet' : policy.id === 'conservative' ? 'amber' : 'emerald'}
                    onClick={() => setPolicyId(policy.id)}
                  />
                ))}
              </div>
            </fieldset>

            <LabRange
              label="Minimum identity similarity"
              value={similarityThreshold}
              output={`${similarityThreshold}/100`}
              min={75}
              max={95}
              step={1}
              accent="emerald"
              lowLabel="Fewer review holds"
              highLabel="Stronger likeness proof"
              onChange={setSimilarityThreshold}
            />
          </div>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <LabMetric
            label="Identity similarity"
            value={`${model.scenario.similarity}/100`}
            detail={`Threshold ${similarityThreshold}`}
            icon={Fingerprint}
            tone={model.identityPass ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Professional score"
            value={`${model.scenario.professional}/100`}
            detail={`Policy minimum ${model.policy.minimumProfessional}`}
            icon={ScanSearch}
            tone={model.professionalPass ? 'cyan' : 'amber'}
          />
          <LabMetric
            label="Appearance-change risk"
            value={`${model.scenario.editRisk}/100`}
            detail={`Policy maximum ${model.policy.maximumEditRisk}`}
            icon={UserRoundCheck}
            tone={model.editPass ? 'emerald' : 'amber'}
          />
          <LabMetric
            label="Policy risk"
            value={`${model.scenario.policyRisk}/100`}
            detail={model.scenario.consent ? 'Consent evidence present' : 'Consent evidence missing'}
            icon={ShieldAlert}
            tone={model.policyPass && model.scenario.consent ? 'emerald' : 'rose'}
          />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            ['Consent', model.scenario.consent],
            ['Identity threshold', model.identityPass],
            ['Professional standard', model.professionalPass],
            ['Bounded edit and policy', model.editPass && model.policyPass],
          ].map(([label, passed]) => (
            <div
              key={String(label)}
              className={`flex items-center gap-3 rounded-md border p-3 text-sm font-semibold ${
                passed
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50'
                  : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
              }`}
            >
              {passed ? <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="h-5 w-5 shrink-0" />}
              {label}
            </div>
          ))}
        </div>

        <div
          className={`mt-5 rounded-md border p-5 ${
            model.disposition === 'release'
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
              : model.disposition === 'review'
                ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40'
                : 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/40'
          }`}
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            {model.disposition === 'release' ? (
              <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-300" />
            ) : model.disposition === 'review' ? (
              <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-300" />
            ) : (
              <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-300" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Release response</p>
              <p className="mt-1 text-lg font-semibold text-neutral-950 dark:text-white">{response}</p>
              <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">{explanation}</p>
            </div>
          </div>
        </div>

        <p className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
          A threshold controls review volume; it does not authorize an exception. Missing consent and deceptive intent are hard stops even when image-quality and similarity scores look good.
        </p>
      </LearningLabBody>
    </LearningLab>
  );
}
