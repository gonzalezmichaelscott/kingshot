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

export default nextConfig
