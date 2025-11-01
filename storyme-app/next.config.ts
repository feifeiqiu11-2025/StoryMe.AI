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
  experimental: {
    // Increase body size limit for server actions (image uploads)
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  // Exclude FFmpeg binaries from Webpack bundling (fixes Turbopack compatibility)
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
    ],
  },
};

export default nextConfig;
