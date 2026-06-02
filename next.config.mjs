import withPWA from 'next-pwa'

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'kingshot.net' },
      { protocol: 'https', hostname: '*.kingshot.net' },
    ],
  },
}

const pwaConfig = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Never let the service worker intercept auth callbacks.
  navigateFallbackDenylist: [/^\/auth/, /^\/api\/auth/],
  runtimeCaching: [
    {
      // Auth routes — never cache. Always hit the network.
      urlPattern: ({ url }) =>
        url.pathname.startsWith('/auth') || url.pathname.startsWith('/api/auth'),
      handler: 'NetworkOnly',
    },
    {
      // Supabase realtime / websockets — never cache.
      urlPattern: ({ url }) =>
        url.pathname.includes('/realtime/') || url.protocol === 'wss:',
      handler: 'NetworkOnly',
    },
    {
      // API routes — network first, fall back to cache when offline.
      urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-cache',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
    {
      // Static assets (icons, images, fonts, scripts, styles) — cache first.
      urlPattern: ({ request }) =>
        ['image', 'font', 'style', 'script'].includes(request.destination),
      handler: 'CacheFirst',
      options: {
        cacheName: 'static-assets',
        expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
    {
      // Everything else (pages) — network first.
      urlPattern: ({ url }) => url.origin === self.location.origin,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages-cache',
        networkTimeoutSeconds: 10,
        expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 },
      },
    },
  ],
})

export default pwaConfig(nextConfig)
