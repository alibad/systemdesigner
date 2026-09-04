"use client";

import { Component, useState, type ReactNode } from "react";
import InteractiveContentBlock from "@/components/content-blocks/InteractiveContentBlock";
import TopologyLab from "@/components/content-blocks/visuals/TopologyLab";
import TrafficSplitDiagram from "@/components/content-blocks/visuals/TrafficSplitDiagram";
import { learningAssetUrl } from "@/lib/learning-assets";
import type { LearningModel } from "@/lib/learning-path";

class ModelBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div role="alert" className="rounded-xl border p-4 text-sm">
        This model couldn’t load. You can continue with practice or reopen the
        model to retry.
      </div>
    ) : (
      this.props.children
    );
  }
}

/** Load only the model the learner opens; large source labs never inflate the
 * introductory lesson or obstruct the single main practice action. */
export default function SourceExploration({
  models,
  revision,
}: {
  models: LearningModel[];
  revision: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  return (
    <section aria-label="Interactive models" className="space-y-3">
      <h2 className="text-base font-semibold">Try the system yourself</h2>
      <p className="text-sm leading-6 text-neutral-500">
        Change a condition and watch what happens. These models are for
        exploration; practice comes next.
      </p>
      {models.map((model, index) => (
        <div key={`${model.kind}:${index}`}>
          <button
            aria-expanded={active === index}
            aria-controls={`learning-model-${index}`}
            onClick={() => setActive(active === index ? null : index)}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-neutral-200 px-4 py-3 text-left text-sm font-semibold hover:border-sky-500 dark:border-neutral-700"
          >
            <span>{model.title}</span>
            <span aria-hidden>{active === index ? "−" : "+"}</span>
          </button>
          {active === index && (
            <div
              id={`learning-model-${index}`}
              className="learning-source-model min-w-0 pt-3"
            >
              <ModelBoundary key={index}>
                {model.kind === "interactive-block" ? (
                  <InteractiveContentBlock
                    id={model.id}
                    dataFile={
                      model.dataFile
                        ? learningAssetUrl(model.dataFile, revision)
                        : undefined
                    }
                  />
                ) : model.kind === "topology-lab" ? (
                  <TopologyLab
                    dataFile={learningAssetUrl(model.dataFile, revision)}
                  />
                ) : (
                  <TrafficSplitDiagram
                    dataFile={learningAssetUrl(model.dataFile, revision)}
                  />
                )}
              </ModelBoundary>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}
