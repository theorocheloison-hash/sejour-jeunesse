import type { Metadata } from 'next';
import { AuthProvider } from '@/src/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Liavo — Coordonnez vos séjours scolaires',
  description: 'Du projet pédagogique à la facturation finale. LIAVO connecte enseignants, directeurs, rectorat, parents et hébergeurs dans un seul workflow.',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Liavo — Coordonnez vos séjours scolaires',
    description: 'Du projet pédagogique à la facturation finale. 649 centres référencés. Chorus Pro intégré.',
    url: 'https://www.liavo.fr',
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
