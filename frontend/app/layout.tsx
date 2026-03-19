import type { Metadata } from 'next';
import { AuthProvider } from '@/src/contexts/AuthContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'Liavo',
  description: 'Gestion des séjours jeunesse',
  robots: {
    index: true,
    follow: true,
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
