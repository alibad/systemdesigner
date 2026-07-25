"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Copy,
  LockKeyhole,
  RefreshCw,
  Rows3,
  Users,
} from "lucide-react";
import {
  LabChoice,
  LabMetric,
  LearningLab,
  LearningLabBody,
  LearningLabHeader,
} from "../../learning/LearningLab";

type SplitId = "random" | "grouped" | "temporal";

const SPLITS = {
  random: {
    label: "Random rows",
    detail:
      "Fast for independent examples, unsafe when related records repeat.",
    icon: Rows3,
  },
  grouped: {
    label: "Group by entity",
    detail: "Keep a user, patient, merchant, or document family together.",
    icon: Users,
  },
  temporal: {
    label: "Time-based boundary",
    detail: "Train on past information and test on a later window.",
    icon: CalendarClock,
  },
} satisfies Record<
  SplitId,
  { label: string; detail: string; icon: typeof Rows3 }
>;

function Toggle({
  checked,
  title,
  detail,
  onChange,
}: {
  checked: boolean;
  title: string;
  detail: string;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={`flex w-full items-start justify-between gap-4 rounded-md border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 ${checked ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40" : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"}`}
    >
      <span>
        <span className="block text-sm font-semibold text-neutral-950 dark:text-white">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-neutral-600 dark:text-neutral-400">
          {detail}
        </span>
      </span>
      <span
        className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-rose-600" : "bg-neutral-300 dark:bg-neutral-700"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform motion-reduce:transition-none ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
        <span className="sr-only">Toggle {title}</span>
      </span>
    </button>
  );
}

export default function MLDatasetsDeepDiveSplitLab() {
  const [splitId, setSplitId] = useState<SplitId>("grouped");
  const [nearDuplicate, setNearDuplicate] = useState(true);
  const [futureData, setFutureData] = useState(false);

  const result = useMemo(() => {
    const entityRisk =
      splitId === "random" ? 45 : splitId === "grouped" ? 5 : 18;
    const duplicateRisk = nearDuplicate ? 32 : 2;
    const temporalRisk = futureData ? 42 : splitId === "temporal" ? 2 : 8;
    const leakage = Math.min(100, entityRisk + duplicateRisk + temporalRisk);
    const reliability = Math.max(0, 100 - leakage);
    const barriers = [
      splitId !== "random",
      !nearDuplicate,
      !futureData || splitId === "temporal",
    ].filter(Boolean).length;
    const status =
      leakage <= 15
        ? "Evaluation boundary holds"
        : leakage <= 45
          ? "Investigation required"
          : "Reported score is not trustworthy";
    const explanation =
      leakage <= 15
        ? "Related records are grouped, near duplicates are screened, and the prediction cutoff is respected. Freeze the manifest and protect final-test access."
        : futureData && splitId !== "temporal"
          ? "Future information crosses the boundary. Use a time-based split with a clear prediction cutoff before interpreting model quality."
          : nearDuplicate
            ? "Close copies can make a held-out result look strong. Cluster or screen near duplicates before assigning partitions."
            : "Related entities appear across partitions. Group by the unit that would reveal the answer, then regenerate the split manifest.";
    return { barriers, leakage, reliability, status, explanation };
  }, [futureData, nearDuplicate, splitId]);

  const reset = () => {
    setSplitId("grouped");
    setNearDuplicate(true);
    setFutureData(false);
  };

  return (
    <LearningLab>
      <LearningLabHeader
        eyebrow="Evaluation boundary lab"
        title="Make leakage visible before a score is trusted"
        description="Choose a split rule, then inject realistic overlap. The model’s apparent test score becomes less reliable whenever related or future information crosses the boundary."
        icon={LockKeyhole}
        accent="rose"
        onReset={reset}
      />
      <LearningLabBody
        controls={
          <div className="space-y-6">
            <fieldset>
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                1. Split policy
              </legend>
              <div className="mt-3 space-y-2">
                {(Object.keys(SPLITS) as SplitId[]).map((id) => {
                  const option = SPLITS[id];
                  return (
                    <LabChoice
                      key={id}
                      selected={splitId === id}
                      label={option.label}
                      detail={option.detail}
                      icon={option.icon}
                      accent="rose"
                      onClick={() => setSplitId(id)}
                    />
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
                2. Inject boundary pressure
              </legend>
              <Toggle
                checked={nearDuplicate}
                title="Near duplicate crosses partitions"
                detail="A paraphrase or template variant appears in both training and final test."
                onChange={() => setNearDuplicate((current) => !current)}
              />
              <Toggle
                checked={futureData}
                title="Future information enters training"
                detail="Records published after the prediction cutoff become training inputs."
                onChange={() => setFutureData((current) => !current)}
              />
            </fieldset>
          </div>
        }
      >
        <div aria-live="polite">
          <div className="grid gap-3 sm:grid-cols-3">
            <LabMetric
              label="Boundary barriers"
              value={`${result.barriers}/3`}
              detail="Controls currently holding"
              icon={LockKeyhole}
              tone={result.barriers === 3 ? "emerald" : "amber"}
            />
            <LabMetric
              label="Leakage pressure"
              value={`${result.leakage}/100`}
              detail="Higher pressure inflates offline results"
              icon={AlertTriangle}
              tone={result.leakage <= 15 ? "emerald" : "rose"}
            />
            <LabMetric
              label="Test reliability"
              value={`${result.reliability}%`}
              detail="Confidence in the held-out estimate"
              icon={CheckCircle2}
              tone={result.reliability >= 85 ? "emerald" : "amber"}
            />
          </div>

          <div
            className="mt-6 grid gap-3 sm:grid-cols-3"
            aria-label="Dataset split visualization"
          >
            {["Training", "Validation", "Final test"].map(
              (partition, index) => {
                const risky =
                  (index === 0 || index === 2) && (nearDuplicate || futureData);
                return (
                  <div
                    key={partition}
                    className={`rounded-md border p-4 ${risky ? "border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40" : "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30"}`}
                  >
                    <p className="text-xs font-semibold uppercase opacity-70">
                      {partition}
                    </p>
                    <div className="mt-4 flex items-center gap-2 text-sm font-semibold">
                      {risky ? (
                        <Copy aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <LockKeyhole aria-hidden="true" className="h-4 w-4" />
                      )}
                      {risky ? "Boundary exposed" : "Partition protected"}
                    </div>
                    <p className="mt-2 text-xs leading-5 opacity-75">
                      {risky
                        ? "Related evidence can influence the reported estimate."
                        : "This partition is isolated from the conflicting record."}
                    </p>
                  </div>
                );
              },
            )}
          </div>

          <div
            className={`mt-6 rounded-md border p-4 ${result.leakage <= 15 ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-50" : "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-50"}`}
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
