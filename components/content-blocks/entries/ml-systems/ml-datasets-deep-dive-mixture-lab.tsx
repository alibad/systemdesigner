"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Braces,
  CheckCircle2,
  Globe2,
  RefreshCw,
  Scale,
  TriangleAlert,
} from "lucide-react";
import {
  LabChoice,
  LabMetric,
  LabRange,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from "../../learning/LearningLab";

type GoalId = "general" | "code" | "research";

const GOALS = {
  general: {
    label: "General assistant",
    detail: "Broad language, practical dialogue, and reference grounding.",
    target: { web: 45, reference: 30, code: 10, community: 15 },
  },
  code: {
    label: "Code assistant",
    detail:
      "Repository context, technical explanations, and implementation patterns.",
    target: { web: 20, reference: 15, code: 45, community: 20 },
  },
  research: {
    label: "Research helper",
    detail:
      "Technical terminology, source traceability, and long-form reasoning.",
    target: { web: 20, reference: 50, code: 10, community: 20 },
  },
} satisfies Record<
  GoalId,
  { label: string; detail: string; target: Record<SourceId, number> }
>;

type SourceId = "web" | "reference" | "code" | "community";

const SOURCES: Array<{
  id: SourceId;
  label: string;
  icon: typeof Globe2;
  tone: "cyan" | "violet" | "emerald" | "amber";
}> = [
  { id: "web", label: "Filtered web", icon: Globe2, tone: "cyan" },
  {
    id: "reference",
    label: "Reference and research",
    icon: BookOpen,
    tone: "violet",
  },
  {
    id: "code",
    label: "Code and documentation",
    icon: Braces,
    tone: "emerald",
  },
  { id: "community", label: "Community Q&A", icon: Scale, tone: "amber" },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

export default function MLDatasetsDeepDiveMixtureLab() {
  const [goalId, setGoalId] = useState<GoalId>("general");
  const [web, setWeb] = useState(45);
  const [reference, setReference] = useState(30);
  const [code, setCode] = useState(10);

  const community = 100 - web - reference - code;
  const result = useMemo(() => {
    const goal = GOALS[goalId];
    const mix = { web, reference, code, community };
    const distance = (Object.keys(mix) as SourceId[]).reduce(
      (total, source) => total + Math.abs(mix[source] - goal.target[source]),
      0,
    );
    const alignment = Math.max(0, 100 - distance * 1.15);
    const dominant = (Object.entries(mix) as Array<[SourceId, number]>).sort(
      (a, b) => b[1] - a[1],
    )[0];
    const underweight = (Object.keys(mix) as SourceId[])
      .filter((source) => goal.target[source] - mix[source] >= 15)
      .map((source) => SOURCES.find((item) => item.id === source)?.label);
    const concentrated = dominant[1] >= 70;
    const status = concentrated
      ? "Concentration warning"
      : alignment >= 80
        ? "Capability coverage is balanced"
        : "A target capability is underfunded";
    const explanation = concentrated
      ? `${SOURCES.find((item) => item.id === dominant[0])?.label} receives ${dominant[1]}% of updates. Large sources can be useful, but this leaves little room for complementary signal and amplifies their artifacts.`
      : underweight.length > 0
        ? `${underweight.join(" and ")} is below this workload's target. Increase it only after confirming rights, provenance, and source-specific quality gates.`
        : "The mix is close to this workload’s target. Freeze the sampling manifest, then validate on protected task slices before scaling training.";

    return { alignment, dominant, status, explanation, concentrated };
  }, [code, community, goalId, reference, web]);

  const reset = () => {
    setGoalId("general");
    setWeb(45);
    setReference(30);
    setCode(10);
  };

  const setSource = (source: SourceId, value: number) => {
    if (source === "web")
      setWeb(clamp(Math.min(value, 100 - reference - code)));
    if (source === "reference")
      setReference(clamp(Math.min(value, 100 - web - code)));
    if (source === "code")
      setCode(clamp(Math.min(value, 100 - web - reference)));
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Mixture design lab"
        title="Spend a finite training budget deliberately"
        description="Choose the workload, then allocate a 100% sampling budget. The remaining share goes to community Q&A so every change has an observable trade-off."
        icon={Scale}
        accent="violet"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Target workload
              </legend>
              <div className="mt-3 space-y-2">
                {(Object.keys(GOALS) as GoalId[]).map((id) => (
                  <LabChoice
                    key={id}
                    selected={goalId === id}
                    label={GOALS[id].label}
                    detail={GOALS[id].detail}
                    icon={
                      id === "code"
                        ? Braces
                        : id === "research"
                          ? BookOpen
                          : Globe2
                    }
                    accent="violet"
                    onClick={() => setGoalId(id)}
                  />
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-5">
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Sampling budget
              </legend>
              <LabRange
                label="Filtered web"
                value={web}
                output={`${web}%`}
                min={0}
                max={100 - reference - code}
                accent="cyan"
                lowLabel="Less breadth"
                highLabel="More breadth"
                onChange={(value) => setSource("web", value)}
              />
              <LabRange
                label="Reference and research"
                value={reference}
                output={`${reference}%`}
                min={0}
                max={100 - web - code}
                accent="violet"
                lowLabel="Less grounding"
                highLabel="More grounding"
                onChange={(value) => setSource("reference", value)}
              />
              <LabRange
                label="Code and documentation"
                value={code}
                output={`${code}%`}
                min={0}
                max={100 - web - reference}
                accent="emerald"
                lowLabel="Less implementation"
                highLabel="More implementation"
                onChange={(value) => setSource("code", value)}
              />
              <p className="border-t border-neutral-200 pt-4 text-sm text-neutral-700 dark:border-neutral-800 dark:text-neutral-300">
                <strong className="text-neutral-950 dark:text-white">
                  Community Q&A:
                </strong>{" "}
                {community}% remaining budget
              </p>
            </fieldset>
          </div>
        }
      >
        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-2">
            <LabMetric
              label="Workload alignment"
              value={`${result.alignment.toFixed(0)}%`}
              detail="Similarity to the selected capability target"
              icon={CheckCircle2}
              tone={result.alignment >= 80 ? "emerald" : "amber"}
            />
            <LabMetric
              label="Largest influence"
              value={`${result.dominant[1]}%`}
              detail={`${SOURCES.find((item) => item.id === result.dominant[0])?.label} of training updates`}
              icon={result.concentrated ? TriangleAlert : Scale}
              tone={result.concentrated ? "rose" : "neutral"}
            />
          </div>

          <div className="mt-5 space-y-3">
            {SOURCES.map((source) => {
              const share = { web, reference, code, community }[source.id];
              const Icon = source.icon;
              return (
                <div
                  key={source.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center justify-between gap-3 text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                      <span className="flex min-w-0 items-center gap-2">
                        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                        {source.label}
                      </span>
                      <span className="tabular-nums">{share}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                      <div
                        className={`h-full ${source.id === "web" ? "bg-cyan-500" : source.id === "reference" ? "bg-violet-500" : source.id === "code" ? "bg-emerald-500" : "bg-amber-500"}`}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className={`mt-6 rounded-md border p-4 ${result.concentrated ? "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50" : "border-neutral-200 bg-neutral-50 text-neutral-900 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-100"}`}
          >
            <p className="text-sm font-semibold">{result.status}</p>
            <p className="mt-2 text-sm leading-6 opacity-80">
              {result.explanation}
            </p>
          </div>
        </div>
      </LearningLabBody>
    </LearningLab>
  );
}
