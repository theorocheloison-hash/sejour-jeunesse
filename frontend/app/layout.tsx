import type { Metadata } from 'next';
import { AuthProvider } from '@/src/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Liavo — La plateforme de coordination des séjours jeunesse',
  description: 'Hébergeurs, enseignants, organisateurs — LIAVO gère tout le flux administratif, du devis à la convention signée, en un seul outil.',
  metadataBase: new URL('https://liavo.fr'),
  alternates: {
    canonical: 'https://liavo.fr',
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    title: 'Liavo — La plateforme de coordination des séjours jeunesse',
    description: 'Hébergeurs, enseignants, organisateurs — LIAVO gère tout le flux administratif, du devis à la convention signée, en un seul outil.',
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
