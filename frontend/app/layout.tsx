import type { Metadata } from 'next';
import { AuthProvider } from '@/src/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Liavo — Coordonnez vos séjours collectifs',
  description: 'Du projet pédagogique à la facturation finale. LIAVO connecte enseignants, directeurs, rectorat, parents et hébergeurs dans un seul workflow.',
  metadataBase: new URL('https://liavo.fr'),
  alternates: {
    canonical: 'https://liavo.fr',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Liavo — Coordonnez vos séjours collectifs',
    description: 'Du projet pédagogique à la facturation finale. Chorus Pro intégré. Conforme RGPD.',
    url: 'https://liavo.fr',
    siteName: 'Liavo',
    locale: 'fr_FR',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
