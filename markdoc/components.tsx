/**
 * The render side of the Markdoc allowlist: maps each tag's `render` name to a real
 * React component. Structural components render on the server; imported interactive
 * components become narrow client islands.
 */

import type React from 'react';
import DesignChallenge from '@/components/challenges/DesignChallengeLazy';
import CapacityChallenge from '@/components/challenges/CapacityChallenge';
import TradeoffChallenge from '@/components/challenges/TradeoffChallenge';
import { Note } from '@/components/mdx-components';
import { CodeBlock as SharedCodeBlock } from '@/components/shared/CodeBlock';
import { InteractiveQuiz } from '@/components/fundamentals/InteractiveLearning';
import InteractiveContentBlock from '@/components/content-blocks/InteractiveContentBlock';
import InteractiveChecklist from '@/components/content-blocks/InteractiveChecklist';
import ToolContext from '@/components/content-blocks/ToolContext';
import TopologyLab from '@/components/content-blocks/visuals/TopologyLab';
import TrafficSplitDiagram from '@/components/content-blocks/visuals/TrafficSplitDiagram';
import {
  ContentAccordion,
  ContentAccordionItem,
} from '@/components/content-blocks/ContentAccordion';
import { ContentTab, ContentTabs } from '@/components/content-blocks/ContentTabs';
import {
  ConceptCard,
  ConceptGrid,
  Metric,
  MetricStrip,
  ProcessFlow,
  ProcessStep,
  SystemFlow,
  SystemNode,
} from '@/markdoc/visual-components';

function Callout({
  variant = 'tip',
  children,
}: {
  variant?: 'tip' | 'warn' | 'info';
  children: React.ReactNode;
}) {
  return <Note variant={variant}>{children}</Note>;
}

function SectionCard({
  tone = 'default',
  accent = 'auto',
  children,
}: {
  tone?: 'default' | 'intro' | 'warn';
  accent?: 'auto' | 'blue' | 'green' | 'violet' | 'amber' | 'rose' | 'cyan';
  children: React.ReactNode;
}) {
  const toneClass =
    tone === 'intro'
      ? 'rounded-lg border border-neutral-200 border-l-4 border-l-indigo-500 bg-neutral-50 p-6 shadow-sm md:p-8 dark:border-neutral-800 dark:border-l-indigo-400 dark:bg-neutral-900/70'
      : tone === 'warn'
        ? 'rounded-lg border border-amber-200 border-l-4 border-l-amber-500 bg-amber-50/70 p-6 dark:border-amber-900/50 dark:border-l-amber-400 dark:bg-amber-950/20'
        : 'border-t border-neutral-200 pt-9 dark:border-neutral-800';
  const sectionClass =
    tone === 'default'
      ? `content-section content-section--default content-section--${accent}`
      : tone === 'intro'
        ? 'content-section content-section--intro'
        : 'content-section content-section--warn';

  return (
    <section className={`not-prose my-11 ${sectionClass} ${toneClass}`}>
      <div className="markdoc-section-copy prose max-w-none">
        {children}
      </div>
    </section>
  );
}

function ResponsiveTable({ children }: { children: React.ReactNode }) {
  return (
    <div className="content-table not-prose my-7 max-w-full overflow-x-auto rounded-lg border border-neutral-200 bg-white shadow-sm scrollbar-thin scrollbar-thumb-neutral-300 scrollbar-track-transparent dark:border-neutral-800 dark:bg-neutral-950 dark:scrollbar-thumb-neutral-700">
      <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm">
        {children}
      </table>
    </div>
  );
}

function CodeBlock({
  file,
  language,
  title,
}: {
  file: string;
  language?: string;
  title?: string;
}) {
  return (
    <div className="not-prose my-6">
      <SharedCodeBlock file={file} language={language} title={title} />
    </div>
  );
}

function Quiz({
  quizId,
  questionsFile,
  title,
  lessonSlug,
}: {
  quizId?: string;
  questionsFile?: string;
  title?: string;
  lessonSlug?: string;
}) {
  return (
    <div className="not-prose mt-12">
      <InteractiveQuiz
        title={title || 'Test Your Understanding'}
        quizId={quizId}
        questionsFile={questionsFile}
        lessonSlug={lessonSlug}
      />
    </div>
  );
}

export const markdocComponents = {
  ResponsiveTable,
  Callout,
  SectionCard,
  CodeBlock,
  Quiz,
  DesignChallenge,
  CapacityChallenge,
  TradeoffChallenge,
  InteractiveContentBlock,
  InteractiveChecklist,
  TopologyLab,
  TrafficSplitDiagram,
  ToolContext,
  ContentAccordion,
  ContentAccordionItem,
  ContentTabs,
  ContentTab,
  ConceptGrid,
  ConceptCard,
  MetricStrip,
  Metric,
  ProcessFlow,
  ProcessStep,
  SystemFlow,
  SystemNode,
};
