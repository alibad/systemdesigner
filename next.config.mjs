import { existsSync, readFileSync } from 'node:fs';

// Links built from registry ids instead of slugs (e.g. /technology/vllm-tech for
// /technology/vllm) were crawled and now 404. Send every such id URL to the lesson's
// real path, unless the id URL is itself a route.
const registry = JSON.parse(
  readFileSync(new URL('./content/registry.json', import.meta.url), 'utf8'),
);
const registryPaths = new Set(registry.map((entry) => entry.path));
const registryIdRedirects = registry
  .filter((entry) => entry.status === 'active')
  .map((entry) => ({ source: `/${entry.section}/${entry.id}`, destination: entry.path }))
  .filter(
    ({ source, destination }) =>
      source !== destination &&
      !registryPaths.has(source) &&
      !existsSync(new URL(`./app${source}`, import.meta.url)),
  )
  .map((redirect) => ({ ...redirect, permanent: true }));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    mdxRs: true,
    outputFileTracingIncludes: {
      '/roadmap': ['./ROADMAP.md'],
      '/api/content/**': [
        './content/entries/**/code/**/*',
        './content/entries/**/quiz/**/*',
        './content/entries/**/data/**/*',
      ],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/lessons/:section/:slug',
        destination: '/:section/:slug',
        permanent: true,
      },
      { source: '/tools/calculators', destination: '/tools', permanent: true },
      // Retired or mislinked lesson URLs that Google reported as 404.
      { source: '/reference/consistent-hashing', destination: '/technology/consistent-hashing', permanent: true },
      { source: '/technology/spinnaker', destination: '/ml-systems/neuromorphic-computing', permanent: true },
      // Lesson and workshop links that pointed at pages that never existed (the links now go to the
      // pages below); send any crawled copies to the page that covers the same topic.
      { source: '/fundamentals/caching', destination: '/reference/caching-strategies', permanent: true },
      { source: '/fundamentals/load-balancing', destination: '/reference/load-balancing', permanent: true },
      { source: '/fundamentals/content-delivery-networks', destination: '/reference/cdn-and-network', permanent: true },
      { source: '/fundamentals/streaming', destination: '/technology/streaming', permanent: true },
      { source: '/ml-systems/ai-agents', destination: '/genai/ai-agents', permanent: true },
      { source: '/ml-systems/model-optimization', destination: '/ml-systems/model-compression-techniques', permanent: true },
      { source: '/workshop/scalability-planning', destination: '/tools/scalability-planner', permanent: true },
      { source: '/workshop/database-design', destination: '/tools/database-selector', permanent: true },
      { source: '/workshop/microservices-design', destination: '/tools/microservices-decomposer', permanent: true },
      { source: '/workshop/performance-optimization', destination: '/tools/latency-analyzer', permanent: true },
      ...registryIdRedirects,
      { source: '/sandbox', destination: '/tools', permanent: false },
      { source: '/sandbox/load-simulator', destination: '/tools/load-testing', permanent: false },
      { source: '/sandbox/capacity-calculator', destination: '/tools/capacity-planning', permanent: false },
      { source: '/sandbox/cdn-analyzer', destination: '/tools/cdn-performance', permanent: false },
      { source: '/sandbox/architecture-guide', destination: '/tools/architecture-decision', permanent: false },
      { source: '/sandbox/reliability-calculator', destination: '/tools/reliability-calculator', permanent: false },
    ];
  }
};

// /learn registers public/learning-sw.js for explicitly allowed learning assets.
export default nextConfig;
