/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // I dati GTFS generati da scripts/build-data.ts vengono letti dal filesystem a runtime.
  outputFileTracingIncludes: { '/api/**/*': ['./data/**/*'], '/**/*': ['./data/meta.json'] },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
        ],
      },
      { source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};
export default nextConfig;
