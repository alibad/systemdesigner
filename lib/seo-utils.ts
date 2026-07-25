import { Metadata } from 'next'
import { CONTENT_REGISTRY, getContentById } from './content-registry'

export interface SEOConfig {
  title?: string
  description?: string
  keywords?: string[]
  contentId?: string
  section?: string
  canonicalUrl?: string
  ogImage?: string
}

/**
 * Generate Next.js metadata from content registry
 */
export function generateMetadata(config: SEOConfig): Metadata {
  const baseUrl = 'https://systemdesigner.io'
  const siteName = 'System Designer'
  
  let title = config.title || 'System Designer - Learn System Design'
  let description = config.description || 'Master system design through interactive lessons, real-world case studies, and practice problems.'
  let keywords = config.keywords || ['system design', 'software architecture', 'scalability', 'distributed systems']
  let canonicalUrl = config.canonicalUrl || baseUrl
  
  // If contentId is provided, use registry data
  if (config.contentId) {
    const content = getContentById(config.contentId)
    if (content) {
      title = `${content.title} - ${siteName}`
      description = content.seo.metaDescription
      keywords = [...content.seo.keywords, ...content.tags]
      canonicalUrl = `${baseUrl}${content.path}`
      
      // Use canonical version if this is a duplicate
      if (content.canonicalId) {
        const canonical = getContentById(content.canonicalId)
        if (canonical) {
          canonicalUrl = `${baseUrl}${canonical.path}`
        }
      }
    }
  }
  
  // Section-specific defaults
  if (config.section) {
    const sectionTitles = {
      fundamentals: 'System Design Fundamentals',
      genai: 'Generative AI & LLMs',
      'ml-systems': 'ML Systems Engineering', 
      technology: 'Technology Deep Dives',
      'case-studies': 'Real-World Case Studies',
      practice: 'System Design Practice',
      reference: 'Quick Reference Guides',
      tools: 'Interactive Tools'
    }
    
    const sectionDescriptions = {
      fundamentals: 'Learn core system design principles and architectural patterns.',
      genai: 'Master generative AI systems, LLM architectures, and AI engineering.',
      'ml-systems': 'Build scalable machine learning systems and MLOps pipelines.',
      technology: 'Deep dive into specific technologies, databases, and frameworks.',
      'case-studies': 'Analyze real-world systems from companies like Netflix, Uber, and Google.',
      practice: 'Solve system design interview problems with step-by-step solutions.',
      reference: 'Quick access to formulas, calculations, and technical references.',
      tools: 'Interactive calculators and tools for system design analysis.'
    }
    
    if (!config.title && sectionTitles[config.section as keyof typeof sectionTitles]) {
      title = `${sectionTitles[config.section as keyof typeof sectionTitles]} - ${siteName}`
    }
    
    if (!config.description && sectionDescriptions[config.section as keyof typeof sectionDescriptions]) {
      description = sectionDescriptions[config.section as keyof typeof sectionDescriptions]
    }
  }

  return {
    title,
    description,
    keywords: keywords.join(', '),
    authors: [{ name: 'System Designer' }],
    creator: 'System Designer',
    publisher: 'System Designer',
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'website',
      siteName,
      title,
      description,
      url: canonicalUrl,
      images: [
        {
          url: config.ogImage || `${baseUrl}/og-image.png`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [config.ogImage || `${baseUrl}/og-image.png`],
    },
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
  }
}

/**
 * Generate structured data (JSON-LD) for educational content
 */
export function generateStructuredData(contentId: string) {
  const content = getContentById(contentId)
  if (!content) return null

  const baseUrl = 'https://systemdesigner.io'
  
  const structuredData: any = {
    '@context': 'https://schema.org',
    '@type': 'EducationalContent',
    name: content.title,
    description: content.seo.metaDescription,
    url: `${baseUrl}${content.path}`,
    dateModified: content.seo.lastModified.toISOString(),
    author: {
      '@type': 'Organization',
      name: 'System Designer',
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: 'System Designer',
      url: baseUrl,
    },
    educationalLevel: content.level,
    timeRequired: content.duration,
    keywords: [...content.seo.keywords, ...content.tags].join(', '),
    inLanguage: 'en-US',
    isAccessibleForFree: true,
    learningResourceType: content.hasQuiz ? 'Interactive Learning' : 'Educational Content',
  }

  // Add prerequisites if any
  if (content.prerequisites.length > 0) {
    const registry = CONTENT_REGISTRY
    const prereqContents = content.prerequisites
      .map(id => registry.find(c => c.id === id))
      .filter(Boolean)
      .map(c => ({
        '@type': 'EducationalContent',
        name: c!.title,
        url: `${baseUrl}${c!.path}`,
      }))

    if (prereqContents.length > 0) {
      structuredData['coursePrerequisites'] = prereqContents
    }
  }

  return structuredData
}

/**
 * Get SEO-optimized page title for dynamic segments
 */
export function getPageTitle(section: string, slug?: string): string {
  const siteName = 'System Designer'
  
  if (!slug) {
    const sectionTitles = {
      fundamentals: 'System Design Fundamentals',
      genai: 'Generative AI & LLMs',
      'ml-systems': 'ML Systems Engineering',
      technology: 'Technology Deep Dives', 
      'case-studies': 'Real-World Case Studies',
      practice: 'System Design Practice',
      reference: 'Quick Reference Guides',
      tools: 'Interactive Tools'
    }
    
    const sectionTitle = sectionTitles[section as keyof typeof sectionTitles] || section
    return `${sectionTitle} - ${siteName}`
  }

  // Try to find content in registry
  const registry = CONTENT_REGISTRY
  const content = registry.find(c => c.path === `/${section}/${slug}`)
  
  if (content) {
    return `${content.title} - ${siteName}`
  }
  
  // Fallback to formatted slug
  const formattedSlug = slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  
  return `${formattedSlug} - ${siteName}`
}

/**
 * Generate breadcrumb structured data
 */
export function generateBreadcrumbData(path: string) {
  const baseUrl = 'https://systemdesigner.io'
  const pathSegments = path.split('/').filter(Boolean)
  
  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: baseUrl,
    }
  ]

  let currentPath = ''
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`
    
    const sectionNames = {
      fundamentals: 'Fundamentals',
      genai: 'GenAI',
      'ml-systems': 'ML Systems',
      technology: 'Technology',
      'case-studies': 'Case Studies',
      practice: 'Practice',
      reference: 'Reference',
      tools: 'Tools'
    }

    let name = sectionNames[segment as keyof typeof sectionNames] || segment
    
    // For specific content pages, try to get title from registry
    if (index === pathSegments.length - 1 && pathSegments.length > 1) {
      const content = getContentById(segment)
      if (content) {
        name = content.title
      } else {
        name = segment.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ')
      }
    }

    breadcrumbItems.push({
      '@type': 'ListItem',
      position: index + 2,
      name,
      item: `${baseUrl}${currentPath}`,
    })
  })

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  }
}