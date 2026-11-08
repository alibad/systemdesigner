import { MetadataRoute } from 'next'
import { CONTENT_REGISTRY, type ContentNode } from '@/lib/content-registry'
import { SITE_URL } from '@/lib/site-config'

type Hub = { path: string; section?: ContentNode['section']; priority: number; changeFrequency: 'weekly' | 'monthly' }

// Hubs list their section's lessons, so a hub changes when its newest lesson does. Google only
// trusts <lastmod> on sites whose dates are accurate: never stamp a page with the build time.
const HUBS: Hub[] = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/fundamentals', section: 'fundamentals', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/genai', section: 'genai', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/ml-systems', section: 'ml-systems', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/technology', section: 'technology', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/case-studies', section: 'case-studies', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/practice', section: 'practice', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/reference', section: 'reference', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/tools', section: 'tools', priority: 0.7, changeFrequency: 'monthly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const active = CONTENT_REGISTRY.filter(content => content.status === 'active')
  const newest = (nodes: ContentNode[]) =>
    new Date(Math.max(...nodes.map(node => node.seo.lastModified.getTime())))

  const hubPages: MetadataRoute.Sitemap = HUBS.map(hub => ({
    url: `${SITE_URL}${hub.path}`,
    lastModified: newest(hub.section ? active.filter(node => node.section === hub.section) : active),
    changeFrequency: hub.changeFrequency,
    priority: hub.priority,
  }))

  const contentPages: MetadataRoute.Sitemap = active.map(content => ({
    url: `${SITE_URL}${content.path}`,
    lastModified: content.seo.lastModified,
    changeFrequency: content.seo.changeFreq,
    priority: content.seo.priority,
  }))

  return [...hubPages, ...contentPages]
}
