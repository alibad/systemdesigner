/**
 * Markdoc tag schema — the CLOSED allowlist that makes lessons provably consistent.
 *
 * Unlike MDX (which compiles to arbitrary JS and can't be sandboxed), every Markdoc
 * tag here is validated against this schema before render: unknown tags or bad
 * attributes are a build-time error, not a runtime surprise. Authors write plain
 * Markdown prose and drop in only these vetted interactive blocks. The render names
 * map to React components in markdoc/components.tsx.
 */
import type { Config, Schema } from '@markdoc/markdoc';

const callout: Schema = {
  render: 'Callout',
  attributes: {
    variant: { type: String, default: 'tip', matches: ['tip', 'warn', 'info'] },
  },
};

const sectionCard: Schema = {
  render: 'SectionCard',
  attributes: {
    tone: { type: String, default: 'default', matches: ['default', 'intro', 'warn'] },
    accent: {
      type: String,
      default: 'auto',
      matches: ['auto', 'blue', 'green', 'violet', 'amber', 'rose', 'cyan'],
    },
  },
};

const codeBlock: Schema = {
  render: 'CodeBlock',
  selfClosing: true,
  attributes: {
    file: { type: String, required: true },
    language: { type: String, default: 'text' },
    title: { type: String },
  },
};

const designChallenge: Schema = {
  render: 'DesignChallenge',
  selfClosing: true,
  attributes: {
    challengeId: { type: String, required: true },
    title: { type: String },
    prompt: { type: String, required: true },
    palette: { type: Array },
  },
};

const capacityChallenge: Schema = {
  render: 'CapacityChallenge',
  selfClosing: true,
  attributes: {
    challengeId: { type: String, required: true },
    title: { type: String },
    prompt: { type: String, required: true },
    fields: { type: Array, required: true },
  },
};

const tradeoff: Schema = {
  render: 'TradeoffChallenge',
  selfClosing: true,
  attributes: {
    challengeId: { type: String, required: true },
    title: { type: String },
    prompt: { type: String, required: true },
    constraint: { type: String },
    options: { type: Array, required: true },
  },
};

const quiz: Schema = {
  render: 'Quiz',
  selfClosing: true,
  attributes: {
    quizId: { type: String },
    questionsFile: { type: String },
    title: { type: String, default: 'Test Your Understanding' },
    lessonSlug: { type: String },
  },
};

const interactiveBlock: Schema = {
  render: 'InteractiveContentBlock',
  selfClosing: true,
  attributes: {
    id: { type: String, required: true },
    dataFile: { type: String },
  },
};

const interactiveChecklist: Schema = {
  render: 'InteractiveChecklist',
  selfClosing: true,
  attributes: {
    checklistId: { type: String, required: true },
    dataFile: { type: String, required: true },
  },
};

const topologyLab: Schema = {
  render: 'TopologyLab',
  selfClosing: true,
  attributes: {
    dataFile: { type: String, required: true },
  },
};

const trafficSplit: Schema = {
  render: 'TrafficSplitDiagram',
  selfClosing: true,
  attributes: {
    dataFile: { type: String, required: true },
  },
};

const toolContext: Schema = {
  render: 'ToolContext',
  selfClosing: true,
  attributes: {
    title: { type: String, required: true },
    question: { type: String, required: true },
    definition: { type: String, required: true },
    inputs: { type: String, required: true },
    outcome: { type: String, required: true },
    experiment: { type: String, required: true },
  },
};

const accordion: Schema = {
  render: 'ContentAccordion',
  attributes: {
    defaultOpen: { type: String, default: 'clarifying' },
  },
};

const accordionItem: Schema = {
  render: 'ContentAccordionItem',
  attributes: {
    id: { type: String, required: true },
    title: { type: String, required: true },
  },
};

const tabs: Schema = {
  render: 'ContentTabs',
};

const tab: Schema = {
  render: 'ContentTab',
  attributes: {
    title: { type: String, required: true },
  },
};

const conceptGrid: Schema = {
  render: 'ConceptGrid',
  attributes: {
    columns: { type: String, default: '2', matches: ['2', '3', '4'] },
  },
};

const conceptCard: Schema = {
  render: 'ConceptCard',
  attributes: {
    title: { type: String, required: true },
    eyebrow: { type: String },
    icon: { type: String },
    tone: {
      type: String,
      default: 'neutral',
      matches: ['blue', 'green', 'violet', 'amber', 'rose', 'cyan', 'neutral'],
    },
  },
};

const metricStrip: Schema = {
  render: 'MetricStrip',
};

const metric: Schema = {
  render: 'Metric',
  selfClosing: true,
  attributes: {
    value: { type: String, required: true },
    label: { type: String, required: true },
    detail: { type: String },
    tone: {
      type: String,
      default: 'neutral',
      matches: ['blue', 'green', 'violet', 'amber', 'rose', 'cyan', 'neutral'],
    },
  },
};

const processFlow: Schema = {
  render: 'ProcessFlow',
};

const processStep: Schema = {
  render: 'ProcessStep',
  attributes: {
    number: { type: String, required: true },
    title: { type: String, required: true },
    label: { type: String },
  },
};

const systemFlow: Schema = {
  render: 'SystemFlow',
  attributes: {
    title: { type: String },
    caption: { type: String },
  },
};

const systemNode: Schema = {
  render: 'SystemNode',
  attributes: {
    title: { type: String, required: true },
    eyebrow: { type: String },
    icon: { type: String },
    tone: {
      type: String,
      default: 'blue',
      matches: ['blue', 'green', 'violet', 'amber', 'rose', 'cyan', 'neutral'],
    },
  },
};

export const config: Config = {
  nodes: {
    table: { render: 'ResponsiveTable' },
  },
  tags: {
    callout,
    'section-card': sectionCard,
    'code-block': codeBlock,
    'design-challenge': designChallenge,
    'capacity-challenge': capacityChallenge,
    tradeoff,
    quiz,
    'interactive-block': interactiveBlock,
    'interactive-checklist': interactiveChecklist,
    'topology-lab': topologyLab,
    'traffic-split': trafficSplit,
    'tool-context': toolContext,
    accordion,
    'accordion-item': accordionItem,
    tabs,
    tab,
    'concept-grid': conceptGrid,
    'concept-card': conceptCard,
    'metric-strip': metricStrip,
    metric,
    'process-flow': processFlow,
    'process-step': processStep,
    'system-flow': systemFlow,
    'system-node': systemNode,
  },
};

/** Tag render-names that count as a graded challenge (used to derive lesson flags). */
export const CHALLENGE_RENDER_NAMES = ['DesignChallenge', 'CapacityChallenge', 'TradeoffChallenge'];
