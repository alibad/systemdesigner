import { Children, type ReactNode } from 'react';
import {
  Activity,
  Boxes,
  Braces,
  CircleCheck,
  Cloud,
  Code2,
  Database,
  Gauge,
  Globe2,
  HardDrive,
  KeyRound,
  Layers3,
  LockKeyhole,
  Network,
  Repeat2,
  Route,
  Scale,
  Search,
  Server,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Users,
  Workflow,
  Zap,
  ArrowDown,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

type Tone = 'blue' | 'green' | 'violet' | 'amber' | 'rose' | 'cyan' | 'neutral';

const ICONS: Record<string, LucideIcon> = {
  activity: Activity,
  boxes: Boxes,
  braces: Braces,
  cache: Layers3,
  check: CircleCheck,
  cloud: Cloud,
  code: Code2,
  database: Database,
  gauge: Gauge,
  globe: Globe2,
  storage: HardDrive,
  key: KeyRound,
  layers: Layers3,
  lock: LockKeyhole,
  network: Network,
  repeat: Repeat2,
  route: Route,
  scale: Scale,
  search: Search,
  server: Server,
  shield: ShieldCheck,
  timer: Timer,
  warning: TriangleAlert,
  users: Users,
  workflow: Workflow,
  speed: Zap,
};

const CARD_TONES: Record<Tone, string> = {
  blue: 'border-blue-200 bg-blue-50/70 dark:border-blue-900/60 dark:bg-blue-950/25',
  green: 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/25',
  violet: 'border-violet-200 bg-violet-50/70 dark:border-violet-900/60 dark:bg-violet-950/25',
  amber: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/25',
  rose: 'border-rose-200 bg-rose-50/70 dark:border-rose-900/60 dark:bg-rose-950/25',
  cyan: 'border-cyan-200 bg-cyan-50/70 dark:border-cyan-900/60 dark:bg-cyan-950/25',
  neutral: 'border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900',
};

const ICON_TONES: Record<Tone, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  rose: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300',
  cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300',
  neutral: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
};

const VALUE_TONES: Record<Tone, string> = {
  blue: 'text-blue-700 dark:text-blue-300',
  green: 'text-emerald-700 dark:text-emerald-300',
  violet: 'text-violet-700 dark:text-violet-300',
  amber: 'text-amber-700 dark:text-amber-300',
  rose: 'text-rose-700 dark:text-rose-300',
  cyan: 'text-cyan-700 dark:text-cyan-300',
  neutral: 'text-neutral-900 dark:text-neutral-100',
};

export function ConceptGrid({
  columns = '2',
  children,
}: {
  columns?: '2' | '3' | '4';
  children: ReactNode;
}) {
  const columnClass =
    columns === '4'
      ? 'sm:grid-cols-2 xl:grid-cols-4'
      : columns === '3'
        ? 'md:grid-cols-2 xl:grid-cols-3'
        : 'md:grid-cols-2';

  return <div className={`not-prose my-7 grid gap-4 ${columnClass}`}>{children}</div>;
}

export function ConceptCard({
  title,
  eyebrow,
  icon = 'boxes',
  tone = 'neutral',
  children,
}: {
  title: string;
  eyebrow?: string;
  icon?: string;
  tone?: Tone;
  children: ReactNode;
}) {
  const Icon = ICONS[icon] || Boxes;

  return (
    <section className={`rounded-lg border p-5 ${CARD_TONES[tone]}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${ICON_TONES[tone]}`}>
          <Icon aria-hidden="true" className="h-5 w-5" />
        </span>
        <div className="min-w-0 pt-0.5">
          {eyebrow && (
            <p className="mb-1 text-xs font-semibold uppercase text-neutral-500 dark:text-neutral-400">
              {eyebrow}
            </p>
          )}
          <h3 className="m-0 text-base font-semibold text-neutral-950 dark:text-white">{title}</h3>
        </div>
      </div>
      <div className="text-sm leading-6 text-neutral-700 dark:text-neutral-300 [&_li]:my-1 [&_li]:pl-1 [&_ol]:my-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-0 [&_ul]:my-0 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

export function MetricStrip({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose my-7 grid overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800 dark:bg-neutral-900">
      {children}
    </div>
  );
}

export function Metric({
  value,
  label,
  detail,
  tone = 'neutral',
}: {
  value: string;
  label: string;
  detail?: string;
  tone?: Tone;
}) {
  return (
    <div className="border-b border-neutral-200 p-5 last:border-b-0 sm:border-r sm:[&:nth-child(2n)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2n)]:border-r lg:last:border-r-0 dark:border-neutral-800">
      <p className={`text-2xl font-semibold ${VALUE_TONES[tone]}`}>{value}</p>
      <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">{label}</p>
      {detail && <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{detail}</p>}
    </div>
  );
}

export function ProcessFlow({ children }: { children: ReactNode }) {
  const steps = Children.toArray(children);
  const columnClass =
    steps.length === 2
      ? 'lg:grid-cols-2'
      : steps.length === 3
        ? 'lg:grid-cols-3'
        : steps.length === 4
          ? 'lg:grid-cols-4'
          : steps.length === 5
            ? 'lg:grid-cols-3 2xl:grid-cols-5'
            : 'lg:grid-cols-3';
  const showDesktopConnectors = steps.length > 1 && steps.length <= 4;

  return (
    <ol className={`not-prose my-8 grid list-none gap-0 p-0 md:grid-cols-2 md:gap-4 ${columnClass}`}>
      {steps.map((step, index) => (
        <li className="relative flex min-w-0 pb-8 last:pb-0 md:pb-0" key={index}>
          {step}
          {index < steps.length - 1 && (
            <>
              <span
                aria-hidden="true"
                className="absolute bottom-1 left-5 flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm md:hidden dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </span>
              {showDesktopConnectors && (
                <span
                  aria-hidden="true"
                  className="absolute -right-3 top-7 z-20 hidden h-6 w-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 shadow-sm lg:flex dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

const PROCESS_STEP_TONES = [
  {
    border: 'border-blue-200 dark:border-blue-900/70',
    bar: 'bg-blue-500 dark:bg-blue-400',
    number: 'bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-950',
    label: 'text-blue-700 dark:text-blue-300',
  },
  {
    border: 'border-violet-200 dark:border-violet-900/70',
    bar: 'bg-violet-500 dark:bg-violet-400',
    number: 'bg-violet-600 text-white dark:bg-violet-400 dark:text-violet-950',
    label: 'text-violet-700 dark:text-violet-300',
  },
  {
    border: 'border-amber-200 dark:border-amber-900/70',
    bar: 'bg-amber-500 dark:bg-amber-400',
    number: 'bg-amber-500 text-amber-950 dark:bg-amber-300 dark:text-amber-950',
    label: 'text-amber-700 dark:text-amber-300',
  },
  {
    border: 'border-emerald-200 dark:border-emerald-900/70',
    bar: 'bg-emerald-500 dark:bg-emerald-400',
    number: 'bg-emerald-600 text-white dark:bg-emerald-400 dark:text-emerald-950',
    label: 'text-emerald-700 dark:text-emerald-300',
  },
  {
    border: 'border-rose-200 dark:border-rose-900/70',
    bar: 'bg-rose-500 dark:bg-rose-400',
    number: 'bg-rose-600 text-white dark:bg-rose-400 dark:text-rose-950',
    label: 'text-rose-700 dark:text-rose-300',
  },
  {
    border: 'border-cyan-200 dark:border-cyan-900/70',
    bar: 'bg-cyan-500 dark:bg-cyan-400',
    number: 'bg-cyan-600 text-white dark:bg-cyan-400 dark:text-cyan-950',
    label: 'text-cyan-700 dark:text-cyan-300',
  },
] as const;

export function ProcessStep({
  number,
  title,
  label,
  children,
}: {
  number: string;
  title: string;
  label?: string;
  children: ReactNode;
}) {
  const parsedNumber = Number.parseInt(number, 10);
  const toneIndex = Number.isFinite(parsedNumber) ? Math.max(parsedNumber - 1, 0) : 0;
  const tone = PROCESS_STEP_TONES[toneIndex % PROCESS_STEP_TONES.length];

  return (
    <section
      className={`relative h-full w-full overflow-hidden rounded-lg border bg-white p-5 shadow-sm transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md dark:bg-neutral-950 ${tone.border}`}
    >
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1 ${tone.bar}`} />
      <header className="mb-4 flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums shadow-sm ${tone.number}`}
        >
          {number}
        </span>
        <div className="min-w-0 pt-0.5">
          {label && (
            <p className={`mb-1 text-xs font-bold uppercase ${tone.label}`}>
              {label}
            </p>
          )}
          <h3 className="m-0 text-base font-semibold leading-6 text-neutral-950 dark:text-white">{title}</h3>
        </div>
      </header>
      <div className="border-t border-neutral-100 pt-3 text-sm leading-6 text-neutral-600 dark:border-neutral-800 dark:text-neutral-300 [&_p]:m-0">
        {children}
      </div>
    </section>
  );
}

export function SystemFlow({
  title,
  caption,
  children,
}: {
  title?: string;
  caption?: string;
  children: ReactNode;
}) {
  const nodes = Children.toArray(children);

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-950 p-5 text-white shadow-sm dark:border-neutral-700">
      {title && <h3 className="mb-1 text-base font-semibold text-white">{title}</h3>}
      {caption && <p className="mb-5 max-w-3xl text-sm leading-6 text-neutral-400">{caption}</p>}
      <div className="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center lg:gap-2">
        {nodes.map((node, index) => (
          <div className="contents" key={index}>
            {node}
            {index < nodes.length - 1 && (
              <ArrowRight aria-hidden="true" className="h-5 w-5 shrink-0 self-center text-neutral-500 rotate-90 lg:rotate-0" />
            )}
          </div>
        ))}
      </div>
    </figure>
  );
}

export function SystemNode({
  title,
  eyebrow,
  icon = 'boxes',
  tone = 'blue',
  children,
}: {
  title: string;
  eyebrow?: string;
  icon?: string;
  tone?: Tone;
  children?: ReactNode;
}) {
  const Icon = ICONS[icon] || Boxes;

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-900 p-4">
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-md ${ICON_TONES[tone]}`}>
        <Icon aria-hidden="true" className="h-4 w-4" />
      </div>
      {eyebrow && <p className="mb-1 text-xs font-medium uppercase text-neutral-500">{eyebrow}</p>}
      <p className="text-sm font-semibold text-white">{title}</p>
      {children && (
        <div className="mt-1 text-xs leading-5 text-neutral-400 [&_p]:m-0">{children}</div>
      )}
    </div>
  );
}
