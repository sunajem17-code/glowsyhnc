/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Allow server actions from any origin in production (Vercel sets its own domain)
      allowedOrigins: ['localhost:3000'],
    },
  },

  // Explicitly expose these to the client bundle.
  // Values are also injected into window.* via app/layout.jsx as a permanent fix.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },

  // Allow <img> tags from external CDNs (thumbnails from Apify/TikTok/Instagram).
  // We use plain <img> not next/image so this is purely for reference,
  // but we whitelist here in case next/image is adopted later.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.tiktokcdn.com' },
      { protocol: 'https', hostname: '**.tiktok.com' },
      { protocol: 'https', hostname: '**.cdninstagram.com' },
      { protocol: 'https', hostname: '**.fbcdn.net' },
      { protocol: 'https', hostname: 'apify-uploads-prod.s3.amazonaws.com' },
    ],
  },
}

export default nextConfig
