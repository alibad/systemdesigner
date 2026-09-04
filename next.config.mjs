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
