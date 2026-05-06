/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,

  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [390, 750, 1080],
    minimumCacheTTL: 86400,
  },

  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },

  serverExternalPackages: ['@solana/web3.js'],
};

module.exports = nextConfig;
