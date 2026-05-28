import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      // www → apex
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.liavo.fr' }],
        destination: 'https://liavo.fr/:path*',
        permanent: true,
      },
      // Anciennes routes dashboard (renommage rôles)
      { source: '/dashboard/teacher/:path*', destination: '/dashboard/organisateur/:path*', permanent: true },
      { source: '/dashboard/teacher', destination: '/dashboard/organisateur', permanent: true },
      { source: '/dashboard/venue/:path*', destination: '/dashboard/hebergeur/:path*', permanent: true },
      { source: '/dashboard/venue', destination: '/dashboard/hebergeur', permanent: true },
      { source: '/dashboard/director/:path*', destination: '/dashboard/signataire/:path*', permanent: true },
      { source: '/dashboard/director', destination: '/dashboard/signataire', permanent: true },
      { source: '/dashboard/rector', destination: '/dashboard/autorite', permanent: true },
      // Anciennes routes register
      { source: '/register/teacher', destination: '/register/organisateur', permanent: true },
      { source: '/register/venue', destination: '/register/hebergeur', permanent: true },
      { source: '/register/director', destination: '/register/signataire', permanent: true },
      // DevisLibres → Devis unifié (Phase 5 migration)
      { source: '/devis-libre/signer/:token', destination: '/devis/signer/:token', permanent: true },
    ];
  },
};

export default nextConfig;
