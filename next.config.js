/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/kie/:path*',
        destination: 'https://api.kie.ai/api/v1/:path*',
      },
      {
        source: '/api/kie-upload/:path*',
        destination: 'https://kieai.redpandaai.co/api/:path*',
      },
    ];
  },
};

module.exports = nextConfig;
