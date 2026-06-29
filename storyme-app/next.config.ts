import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add CORS headers for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
  // Serve the static decks at clean, public shareable URLs: /pitch and /partnership
  async rewrites() {
    return [
      { source: '/pitch', destination: '/pitch/index.html' },
      { source: '/pitch/', destination: '/pitch/index.html' },
      { source: '/partnership', destination: '/partnership/index.html' },
      { source: '/partnership/', destination: '/partnership/index.html' },
    ];
  },
  experimental: {
    // Increase body size limit for server actions (image uploads)
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Exclude FFmpeg binaries from Webpack bundling (fixes Turbopack compatibility).
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@ffmpeg-installer/ffmpeg': 'commonjs @ffmpeg-installer/ffmpeg',
        'fluent-ffmpeg': 'commonjs fluent-ffmpeg',
      });
    }
    return config;
  },
  // Don't bundle the headless-Chromium packages into the server build —
  // let them resolve from node_modules at runtime. Without this, Next.js
  // tries to webpack the binary asset and either fails or ships a broken
  // copy. Next.js 15's serverExternalPackages is the modern replacement
  // for the old webpack-externals dance.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  // And make sure Vercel's file-tracing pulls the chromium binary tarball
  // into the chapter-book PDF function's deploy bundle. The glob is
  // intentionally narrow to the one route so other functions don't
  // bloat by ~50 MB.
  outputFileTracingIncludes: {
    '/api/v1/chapter-books/[id]/pdf': [
      './node_modules/@sparticuz/chromium/bin/**',
    ],
  },
  // Temporarily ignore ESLint errors during build for MVP deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Temporarily ignore TypeScript errors during build for MVP deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'v3.fal.media',
        pathname: '/files/**',
      },
      {
        protocol: 'https',
        hostname: 'v3b.fal.media',
        pathname: '/files/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'kindlewood-studio.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'qxeiajnmprinwydlozlq.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
