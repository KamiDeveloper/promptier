import type { NextConfig } from 'next'
import withPWAInit, { runtimeCaching as defaultRuntimeCaching } from '@ducanh2912/next-pwa'

const runtimeCaching = defaultRuntimeCaching.map((entry) => {
  if (entry.options?.cacheName !== 'apis') return entry

  return {
    ...entry,
    urlPattern: ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) => (
      sameOrigin &&
      url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/api/auth/') &&
      url.pathname !== '/api/profile'
    ),
  }
})

const withPWA = withPWAInit({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
  },
  workboxOptions: {
    disableDevLogs: true,
    runtimeCaching,
  },
})

const nextConfig: NextConfig = {
  experimental: {
    // Next.js 15 App Router optimizations
  },
  images: {
    formats: ['image/webp', 'image/avif'],
    // Remote image patterns for Neon-stored optimized images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.neon.tech',
      },
    ],
  },
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default withPWA(nextConfig)
