import { MetadataRoute } from 'next'
import { CONTENT_REGISTRY } from '@/lib/content-registry'

export default function sitemap(): MetadataRoute.Sitemap {
  const registry = CONTENT_REGISTRY
  const baseUrl = 'https://systemdesigner.net'
  
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/fundamentals`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/genai`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/ml-systems`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/technology`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/case-studies`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/practice`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/reference`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${baseUrl}/tools`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]

  // Dynamic pages from content registry
  const contentPages: MetadataRoute.Sitemap = registry
    .filter(content => content.status === 'active')
    .map(content => ({
      url: `${baseUrl}${content.path}`,
      lastModified: content.seo.lastModified,
      changeFrequency: content.seo.changeFreq,
      priority: content.seo.priority,
    }))

  return [...staticPages, ...contentPages]
}