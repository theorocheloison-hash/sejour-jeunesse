import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1">{children}</div>
      <footer className="border-t border-gray-100 bg-white py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-gray-400">
            © 2026 LIAVO SASU · SIRET 102 994 910 00010 · RCS Annecy
          </span>
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400">
            <Link href="/legal/mentions-legales" className="hover:text-gray-600 transition-colors">Mentions légales</Link>
            <Link href="/legal/cgu" className="hover:text-gray-600 transition-colors">CGU</Link>
            <Link href="/legal/confidentialite" className="hover:text-gray-600 transition-colors">Confidentialité</Link>
            <Link href="/legal/cgv-hebergeurs" className="hover:text-gray-600 transition-colors">CGV Hébergeurs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
