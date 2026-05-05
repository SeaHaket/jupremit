/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  // Required for Solana wallet adapter on Vercel edge runtime
  serverExternalPackages: ['@solana/web3.js'],
};

module.exports = nextConfig;
