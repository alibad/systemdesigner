import type { Metadata } from 'next';
import relatedContent from '@/content/related-content.json';
import { getContentById, type ContentNode } from '@/lib/content-registry';
import { getSectionRouteConfig, type RenderableContent } from '@/lib/content-model';
import { SITE_URL } from '@/lib/site-config';

const SITE_NAME = 'System Designer';
const SHARE_IMAGE = { url: '/icons/icon-512x512.png', width: 512, height: 512, alt: SITE_NAME };

const GENERATED_RELATED = (relatedContent as { entries: Record<string, string[]> }).entries;

/** "45 min" -> "PT45M", the ISO 8601 duration schema.org expects for timeRequired. */
export function toIsoDuration(duration: string): string | undefined {
  const minutes = Number(duration.match(/(\d+)\s*min/i)?.[1] ?? 0) + Number(duration.match(/(\d+)\s*h/i)?.[1] ?? 0) * 60;
  return minutes > 0 ? `PT${minutes}M` : undefined;
}

export interface ContentLink {
  id: string;
  title: string;
  path: string;
  sectionTitle: string;
  description: string;
}

function toLink(node: ContentNode): ContentLink {
  return {
    id: node.id,
    title: node.title,
    path: node.path,
    sectionTitle: getSectionRouteConfig(node.section).title,
    description: node.seo.metaDescription,
  };
}

/**
 * The lessons a page links to under its body: its hand-picked `related` ids first, then the
 * closest pages from content/related-content.json (scripts/generate-related-content.mjs).
 * Prerequisites and the previous/next lesson are rendered separately and left out here.
 */
export function getContentLinks(content: RenderableContent, limit = 6) {
  const excluded = new Set<string>([
    content.id,
    ...content.node.prerequisites,
    ...(content.navigation.previous ? [content.navigation.previous.id] : []),
    ...(content.navigation.next ? [content.navigation.next.id] : []),
  ]);
  const ids = [...content.node.related, ...(GENERATED_RELATED[content.id] ?? [])];
  const related: ContentLink[] = [];
  for (const id of ids) {
    if (excluded.has(id)) continue;
    const node = getContentById(id);
    if (!node || node.status !== 'active') continue;
    excluded.add(id);
    related.push(toLink(node));
    if (related.length >= limit) break;
  }

  return {
    prerequisites: content.navigation.prerequisites.filter((node) => node.status === 'active').map(toLink),
    related,
  };
}

export function getBreadcrumbs(content: RenderableContent) {
  const section = getSectionRouteConfig(content.section);
  return [
    { name: 'Home', path: '/' },
    { name: section.title, path: section.landingPath },
    { name: content.title, path: content.path },
  ];
}

/** Open Graph and Twitter tags for a registry page, so shares and crawlers see this page, not the home page. */
export function buildContentSocialMetadata(content: RenderableContent, title: string, description?: string): Pick<Metadata, 'openGraph' | 'twitter'> {
  return {
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      locale: 'en_US',
      url: content.path,
      title,
      description,
      modifiedTime: content.seo.lastModified.toISOString(),
      section: getSectionRouteConfig(content.section).title,
      tags: content.seo.keywords,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: [SHARE_IMAGE.url],
    },
  };
}

const LEARNING_RESOURCE_TYPE: Record<RenderableContent['shell'], string> = {
  lesson: 'Lesson',
  technology: 'Technology guide',
  'case-study': 'Case study',
  practice: 'Practice problem',
  reference: 'Reference guide',
  tool: 'Interactive tool',
};

/** JSON-LD for a registry page: the page itself plus its breadcrumb trail. */
export function buildContentJsonLd(content: RenderableContent) {
  const url = `${SITE_URL}${content.path}`;
  const section = getSectionRouteConfig(content.section);
  const organization = {
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}${SHARE_IMAGE.url}`,
  };

  const page = {
    '@context': 'https://schema.org',
    '@type': content.shell === 'tool' ? 'LearningResource' : 'TechArticle',
    '@id': `${url}#content`,
    url,
    mainEntityOfPage: url,
    headline: (content.seo.title ?? content.title).slice(0, 110),
    name: content.title,
    description: content.seo.metaDescription,
    image: `${SITE_URL}${SHARE_IMAGE.url}`,
    inLanguage: 'en',
    dateModified: content.seo.lastModified.toISOString(),
    author: organization,
    publisher: organization,
    isAccessibleForFree: true,
    learningResourceType: LEARNING_RESOURCE_TYPE[content.shell],
    educationalLevel: content.level,
    timeRequired: toIsoDuration(content.duration),
    keywords: content.seo.keywords.join(', '),
    articleSection: content.shell === 'tool' ? undefined : section.title,
    isPartOf: {
      '@type': 'CollectionPage',
      name: `${section.title} | ${SITE_NAME}`,
      url: `${SITE_URL}${section.landingPath}`,
    },
  };

  const breadcrumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: getBreadcrumbs(content).map((crumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: crumb.name,
      item: `${SITE_URL}${crumb.path === '/' ? '' : crumb.path}`,
    })),
  };

  return [page, breadcrumbs];
}

/** Serialize JSON-LD for a <script> tag without letting content close the tag early. */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
