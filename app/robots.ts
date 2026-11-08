import { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-config'

// One group for every crawler: a crawler obeys only the most specific group that names it, so
// separate Googlebot/Bingbot groups had silently dropped the /admin/ rule for them.
// Lessons load their code examples, quizzes and lab data from /api/content and /api/quiz-bank
// in the browser. Those stay crawlable (and send X-Robots-Tag: noindex, see next.config.mjs)
// so Google's renderer sees the whole lesson; the longer Allow rules win over Disallow /api/.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/content/', '/api/quiz-bank/'],
        disallow: ['/api/', '/admin/', '/private/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
