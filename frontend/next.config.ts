import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.liavo.fr' }],
        destination: 'https://liavo.fr/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
