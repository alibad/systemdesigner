import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AdminEditContentLink from '@/components/admin/AdminEditContentLink';
import CapacityChallenge from '@/components/challenges/CapacityChallenge';
import ContentBreadcrumbs from '@/components/content/ContentBreadcrumbs';
import ContentRelatedLinks from '@/components/content/ContentRelatedLinks';
import DailyReviewCard from '@/components/challenges/DailyReviewCard';
import TradeoffChallenge from '@/components/challenges/TradeoffChallenge';
import LessonCompletion from '@/components/LessonCompletion';
import LessonHeader from '@/components/fundamentals/LessonHeader';
import MarkdocLesson from '@/components/markdoc/MarkdocLesson';
import ImprovePage from '@/components/shared/ImprovePage';
import type { LearningCategory } from '@/hooks/useProgressTracking';
import {
  getRenderableContentBySection,
  getRenderableContentBySlug,
  toTitleCaseLevel,
  type ContentSection,
  type ContentShellKind,
} from '@/lib/content-model';
import {
  buildContentJsonLd,
  buildContentSocialMetadata,
  getBreadcrumbs,
  getContentLinks,
  jsonLdScript,
} from '@/lib/content-seo';
import { loadLesson } from '@/lib/lessons';
import { isGradedPractice, PRACTICE_CHALLENGES } from '@/lib/practice-challenges';

const SHELL_POLICY: Record<
  ContentShellKind,
  {
    showHeader: boolean;
    showDailyReview: boolean;
    showCompletion: boolean;
    bodyClassName: string;
  }
> = {
  lesson: {
    showHeader: true,
    showDailyReview: true,
    showCompletion: true,
    bodyClassName: 'prose prose-neutral dark:prose-invert max-w-none',
  },
  technology: {
    showHeader: true,
    showDailyReview: false,
    showCompletion: true,
    bodyClassName: 'prose prose-neutral dark:prose-invert max-w-none',
  },
  'case-study': {
    showHeader: true,
    showDailyReview: false,
    showCompletion: true,
    bodyClassName: 'prose prose-neutral dark:prose-invert max-w-none',
  },
  practice: {
    showHeader: true,
    showDailyReview: false,
    showCompletion: true,
    bodyClassName: 'prose prose-neutral dark:prose-invert max-w-none',
  },
  reference: {
    showHeader: true,
    showDailyReview: false,
    showCompletion: true,
    bodyClassName: 'prose prose-neutral dark:prose-invert max-w-none',
  },
  tool: {
    showHeader: false,
    showDailyReview: false,
    showCompletion: false,
    bodyClassName: 'max-w-none',
  },
};

function PracticeChallengeBlocks({ slug }: { slug: string }) {
  const challenge = PRACTICE_CHALLENGES[slug];

  if (!challenge) return null;

  return (
    <>
      {challenge.capacity && <CapacityChallenge {...challenge.capacity} />}
      {challenge.tradeoff && <TradeoffChallenge {...challenge.tradeoff} />}
    </>
  );
}

export function generateContentStaticParams(section: ContentSection) {
  return getRenderableContentBySection(section).map((content) => ({ slug: content.slug }));
}

export function generateContentMetadata(section: ContentSection, slug: string): Metadata {
  const content = getRenderableContentBySlug(section, slug);
  const entry = loadLesson(section, slug);
  if (!content || !entry) return {};

  const title = content.seo.title ?? content.title;
  const description = content.seo.metaDescription || entry.frontmatter.description;

  return {
    title,
    description,
    alternates: { canonical: content.path },
    ...buildContentSocialMetadata(content, `${title} | System Designer`, description),
  };
}

export default function GeneralizedContentPage({
  section,
  slug,
}: {
  section: ContentSection;
  slug: string;
}) {
  const content = getRenderableContentBySlug(section, slug);
  if (!content) notFound();

  const entry = loadLesson(section, slug);
  if (!entry) notFound();

  const next = content.navigation.next;
  const previous = content.navigation.previous;
  const policy = SHELL_POLICY[content.shell];
  const links = getContentLinks(content);

  return (
    <>
      {buildContentJsonLd(content).map((data) => (
        <script
          key={data['@type'] as string}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(data) }}
        />
      ))}

      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-4 pb-0">
        <ContentBreadcrumbs crumbs={getBreadcrumbs(content)} />
      </div>

      {policy.showHeader && (
        <LessonHeader
          title={content.title}
          description={content.seo.metaDescription || entry.frontmatter.description}
          duration={content.duration}
          level={toTitleCaseLevel(content.level)}
          lessonSlug={content.slug}
          hasQuiz={content.hasQuiz}
          category={section as LearningCategory}
        />
      )}

      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8 pt-4">
        {policy.showDailyReview && <DailyReviewCard />}

        <article className={policy.bodyClassName} data-content-shell={content.shell}>
          <MarkdocLesson tree={entry.tree} />
        </article>

        {content.shell === 'practice' && <PracticeChallengeBlocks slug={content.slug} />}

        {policy.showCompletion && (
          <div className="mt-12">
            <LessonCompletion
              lessonSlug={content.slug}
              category={section as LearningCategory}
              masteryGated={
                entry.derived.hasChallenge ||
                content.hasChallenge ||
                (content.shell === 'practice' && isGradedPractice(content.slug))
              }
              nextLessonUrl={next?.renderPath}
              nextLessonTitle={next?.title}
            />
          </div>
        )}

        <ContentRelatedLinks
          previous={previous}
          next={next}
          prerequisites={links.prerequisites}
          related={links.related}
        />

        <AdminEditContentLink section={section} slug={slug} />

        <ImprovePage path={content.path} title={content.title} />
      </div>
    </>
  );
}
