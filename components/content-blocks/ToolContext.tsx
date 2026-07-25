import { Activity, FlaskConical, SlidersHorizontal, Sparkles } from 'lucide-react';

export default function ToolContext({
  title,
  question,
  definition,
  inputs,
  outcome,
  experiment,
}: {
  title: string;
  question: string;
  definition: string;
  inputs: string;
  outcome: string;
  experiment: string;
}) {
  const stages = [
    { label: 'Model', copy: inputs, icon: SlidersHorizontal, tone: 'text-blue-300 bg-blue-500/15' },
    { label: 'Observe', copy: outcome, icon: Activity, tone: 'text-emerald-300 bg-emerald-500/15' },
    { label: 'Challenge', copy: experiment, icon: FlaskConical, tone: 'text-amber-300 bg-amber-500/15' },
  ];

  return (
    <section className="not-prose mb-8 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950 text-white shadow-xl shadow-neutral-950/10">
      <div className="border-b border-neutral-800 px-5 py-6 md:px-7 md:py-7">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
          <Sparkles aria-hidden="true" className="h-4 w-4" />
          Interactive design lab
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-tight text-white md:text-3xl">{title}</h1>
        <h2 className="mt-5 text-base font-semibold text-neutral-200">{question}</h2>
        <p className="mt-2 max-w-4xl text-base leading-7 text-neutral-400">{definition}</p>
      </div>

      <div className="grid md:grid-cols-3">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.label}
              className="border-b border-neutral-800 px-5 py-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 md:px-6"
            >
              <div className="flex items-center gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${stage.tone}`}>
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase text-neutral-500">Step {index + 1}</p>
                  <h3 className="text-sm font-semibold text-white">{stage.label}</h3>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-neutral-400">{stage.copy}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
