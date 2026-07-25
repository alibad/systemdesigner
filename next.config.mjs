import withPWA from 'next-pwa';

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    typedRoutes: true,
    mdxRs: true,
    outputFileTracingIncludes: {
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

// Temporarily disable PWA to debug build issues
// export default withPWA({
//   dest: 'public',
//   register: true,
//   skipWaiting: true,
//   disable: process.env.NODE_ENV === 'development',
//   runtimeCaching: [
//     {
//       urlPattern: /^https?.*/,
//       handler: 'NetworkFirst',
//       options: {
//         cacheName: 'offlineCache',
//         expiration: {
//           maxEntries: 200,
//           maxAgeSeconds: 24 * 60 * 60 * 30, // 30 days
//         },
//       },
//     },
//   ],
// })(nextConfig);

export default nextConfig;
