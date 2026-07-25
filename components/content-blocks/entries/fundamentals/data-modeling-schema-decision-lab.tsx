'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleAlert,
  Database,
  KeyRound,
  Link2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from '@/components/content-blocks/learning/LearningLab';

type ScenarioId = 'orders' | 'memberships' | 'profile';
type Relationship = 'one-to-one' | 'one-to-many' | 'many-to-many';

const scenarios: Record<
  ScenarioId,
  {
    label: string;
    detail: string;
    expected: Relationship;
    source: string;
    target: string;
    invariant: string;
    constraint: string;
  }
> = {
  orders: {
    label: 'Customer orders',
    detail: 'One customer can place many orders; every order has one customer.',
    expected: 'one-to-many',
    source: 'customers',
    target: 'orders',
    invariant: 'Every order names one existing customer, while customer history can grow.',
    constraint: 'orders.customer_id NOT NULL REFERENCES customers(id)',
  },
  memberships: {
    label: 'Project members',
    detail: 'Users can join multiple projects, and each project has multiple users.',
    expected: 'many-to-many',
    source: 'users',
    target: 'projects',
    invariant: 'The same user may not be added to the same project twice.',
    constraint: 'PRIMARY KEY (user_id, project_id) on project_memberships',
  },
  profile: {
    label: 'Account profile',
    detail: 'Each account has at most one separately stored profile.',
    expected: 'one-to-one',
    source: 'accounts',
    target: 'profiles',
    invariant: 'A profile cannot be shared by two accounts or duplicated for one account.',
    constraint: 'profiles.account_id UNIQUE NOT NULL REFERENCES accounts(id)',
  },
};

const relationships: Array<{
  id: Relationship;
  label: string;
  detail: string;
}> = [
  { id: 'one-to-one', label: 'One to one', detail: 'One row matches at most one row.' },
  { id: 'one-to-many', label: 'One to many', detail: 'One parent owns many child rows.' },
  { id: 'many-to-many', label: 'Many to many', detail: 'Use a junction row for each pairing.' },
];

export default function DataModelingSchemaDecisionLab() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('orders');
  const [relationship, setRelationship] = useState<Relationship>('one-to-many');
  const [enforceConstraint, setEnforceConstraint] = useState(true);

  const scenario = scenarios[scenarioId];
  const result = useMemo(() => {
    const shapeMatches = relationship === scenario.expected;
    const protectedInvariant = shapeMatches && enforceConstraint;
    const relationshipTable = relationship === 'many-to-many';
    const relationshipName = `${scenario.source.slice(0, -1)}_${scenario.target.slice(0, -1)}s`;
    const schema = relationshipTable
      ? `${scenario.source} <-> ${relationshipName} <-> ${scenario.target}`
      : `${scenario.target}.${scenario.source.slice(0, -1)}_id`;
    const failure = !shapeMatches
      ? `This shape cannot express the stated cardinality. ${relationship === 'one-to-one' ? 'A uniqueness rule would discard valid repeated relationships.' : relationship === 'one-to-many' ? 'One foreign key cannot represent both sides having many matches.' : 'A junction table would add an unnecessary pairing layer for this rule.'}`
      : !enforceConstraint
        ? 'The table shape is plausible, but application code could still write an orphan, duplicate, or missing relationship.'
        : `The database can reject writes that violate: ${scenario.invariant}`;

    return { shapeMatches, protectedInvariant, relationshipTable, schema, failure };
  }, [enforceConstraint, relationship, scenario]);

  const selectScenario = (id: ScenarioId) => {
    setScenarioId(id);
    setRelationship(scenarios[id].expected);
    setEnforceConstraint(true);
  };

  const reset = () => {
    setScenarioId('orders');
    setRelationship('one-to-many');
    setEnforceConstraint(true);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Schema and relationship lab"
        title="Turn one business sentence into an enforceable relationship"
        description="Choose a relationship shape, then decide whether the database enforces it. The schema preview exposes what each choice permits or rejects."
        icon={Link2}
        accent="cyan"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Business fact
              </legend>
              <div className="mt-3 space-y-2">
                {(Object.keys(scenarios) as ScenarioId[]).map((id) => (
                  <LabChoice
                    key={id}
                    selected={scenarioId === id}
                    label={scenarios[id].label}
                    detail={scenarios[id].detail}
                    icon={id === 'memberships' ? UsersRound : id === 'profile' ? KeyRound : Database}
                    accent="cyan"
                    onClick={() => selectScenario(id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Relationship shape
              </legend>
              <div className="mt-3 space-y-2">
                {relationships.map((item) => (
                  <LabChoice
                    key={item.id}
                    selected={relationship === item.id}
                    label={item.label}
                    detail={item.detail}
                    accent="violet"
                    onClick={() => setRelationship(item.id)}
                  />
                ))}
              </div>
            </fieldset>

            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950">
              <span>
                <span className="block text-sm font-semibold text-neutral-950 dark:text-white">Enforce the invariant</span>
                <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">Use foreign keys, non-null rules, and uniqueness where the fact requires them.</span>
              </span>
              <input
                type="checkbox"
                checked={enforceConstraint}
                onChange={(event) => setEnforceConstraint(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-cyan-600"
              />
            </label>
          </div>
        }
      >
        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabMetric
              label="Cardinality"
              value={relationships.find((item) => item.id === relationship)?.label ?? relationship}
              detail={result.shapeMatches ? 'Matches the stated business fact' : `Expected ${relationships.find((item) => item.id === scenario.expected)?.label}`}
              icon={Link2}
              tone={result.shapeMatches ? 'emerald' : 'rose'}
            />
            <LabMetric
              label="Database protection"
              value={result.protectedInvariant ? 'Enforced' : 'Missing'}
              detail={result.relationshipTable ? 'A junction table represents each pairing' : 'A foreign key represents ownership'}
              icon={result.protectedInvariant ? ShieldCheck : CircleAlert}
              tone={result.protectedInvariant ? 'emerald' : 'amber'}
            />
          </div>

          <div className="mt-5 overflow-x-auto rounded-md border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-800 dark:bg-neutral-900/50">
            <div className="min-w-[430px]">
              <p className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">Schema preview</p>
              <div className="mt-4 flex items-center gap-3">
                <SchemaNode label={scenario.source} detail="Parent records" />
                <span className="shrink-0 text-lg text-neutral-400" aria-hidden="true">{result.relationshipTable ? '<->' : '->'}</span>
                {result.relationshipTable ? <SchemaNode label={`${scenario.source.slice(0, -1)}_${scenario.target.slice(0, -1)}s`} detail="One row per pairing" emphasis /> : null}
                {result.relationshipTable ? <span className="shrink-0 text-lg text-neutral-400" aria-hidden="true">{'<->'}</span> : null}
                <SchemaNode label={scenario.target} detail={result.relationshipTable ? 'Related records' : 'Child records'} />
              </div>
              <p className="mt-4 font-mono text-xs leading-5 text-neutral-700 dark:text-neutral-300">{result.schema}</p>
              <p className="mt-2 font-mono text-xs leading-5 text-cyan-800 dark:text-cyan-200">{enforceConstraint ? scenario.constraint : 'No database constraint selected'}</p>
            </div>
          </div>

          <div className={`mt-5 rounded-md border p-4 ${result.protectedInvariant ? 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-50' : 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-50'}`}>
            <div className="flex items-start gap-3">
              {result.protectedInvariant ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CircleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
              <div>
                <p className="text-sm font-semibold">{result.protectedInvariant ? 'The model expresses and protects the fact' : 'The relationship contract has a gap'}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{result.failure}</p>
              </div>
            </div>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}

function SchemaNode({ label, detail, emphasis = false }: { label: string; detail: string; emphasis?: boolean }) {
  return (
    <div className={`w-36 shrink-0 rounded-md border p-3 ${emphasis ? 'border-violet-300 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/40' : 'border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950'}`}>
      <p className="truncate text-sm font-semibold text-neutral-950 dark:text-white">{label}</p>
      <p className="mt-1 text-xs leading-4 text-neutral-500 dark:text-neutral-400">{detail}</p>
    </div>
  );
}
