import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo : épingle la racine du file-tracing au dossier frontend. Sans cela,
  // Next infère la racine du dépôt (présence d'un package.json/-lock.json racine)
  // et imbrique la sortie standalone sous .next/standalone/frontend/, ce qui casse
  // les chemins du Procfile (cp .next/standalone/.next/static …). cwd = racine de
  // l'app frontend au build (local et Scalingo).
  outputFileTracingRoot: process.cwd(),
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://api.liavo.fr'}/:path*`,
      },
    ];
  },
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
      // URL courante → page légale
      { source: '/politique-confidentialite', destination: '/legal/confidentialite', permanent: true },
    ];
  },
};

export default nextConfig;
