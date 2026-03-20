'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMonProfil, uploadCentreImage } from '@/src/lib/centre';
import { getMesDevis } from '@/src/lib/devis';
import { getMesSejoursConvention } from '@/src/lib/collaboration';

export default function VenueDashboard() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [centre, setCentre] = useState<any>(null);
  const [devis, setDevis] = useState<any[]>([]);
  const [sejoursConvention, setSejoursConvention] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'VENUE')) router.replace('/login');
  }, [isLoading, user, router]);

  const loadData = useCallback(async () => {
    try {
      const [profil, mesDevis, sejours] = await Promise.all([
        getMonProfil(),
        getMesDevis(),
        getMesSejoursConvention(),
      ]);
      setCentre(profil);
      setDevis(mesDevis);
      setSejoursConvention(sejours);
    } catch {}
  }, []);

  useEffect(() => {
    if (user?.role === 'VENUE') loadData();
  }, [user, loadData]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const updated = await uploadCentreImage(file);
      setCentre((prev: any) => ({ ...prev, imageUrl: updated.imageUrl }));
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !user) return null;

  // Métriques
  const demandesNonLues = devis.filter(d => d.statut === 'EN_ATTENTE' && !d.estFacture).length;
  const devisEnAttente = devis.filter(d => d.statut === 'EN_ATTENTE').length;
  const devisSelectionnes = devis.filter(d => d.statut === 'SELECTIONNE').length;
  const caPrevi = devis
    .filter(d => d.statut === 'SELECTIONNE')
    .reduce((sum: number, d: any) => sum + (d.montantTTC ?? Number(d.montantTotal) ?? 0), 0);
  const acomptesAttente = devis.filter(d => d.statut === 'SELECTIONNE' && d.typeDocument === 'FACTURE_ACOMPTE' && !d.acompteVerse).length;
  const abonnementActif = centre?.abonnementStatut === 'ACTIF';
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">

      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary)] flex items-center justify-center text-white text-xs font-bold">
            {centre?.nom?.[0] ?? 'H'}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{centre?.nom ?? 'Mon établissement'}</p>
            <p className="text-xs text-gray-500">{centre?.ville}</p>
          </div>
        </div>
        <button onClick={logout} className="text-xs text-gray-400 hover:text-gray-600">Déconnexion</button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Alerte abonnement — discrète */}
        {!abonnementActif && (
          <div className="flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-sm text-amber-700">Abonnement inactif — accès aux demandes limité.</p>
            <Link href="/dashboard/venue/abonnement" className="text-xs font-semibold text-amber-700 underline hover:no-underline">
              Activer
            </Link>
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Séjours en convention', value: sejoursConvention.length, color: 'text-[var(--color-primary)]', icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21' },
            { label: 'Devis en attente', value: devisEnAttente, color: 'text-orange-600', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z' },
            { label: 'Devis sélectionnés', value: devisSelectionnes, color: 'text-green-600', icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
            { label: 'CA prévisionnel', value: `${fmt(caPrevi)} €`, color: 'text-[var(--color-primary)]', icon: 'M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z' },
          ].map((kpi, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">{kpi.label}</p>
                <svg className={`w-4 h-4 ${kpi.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={kpi.icon} />
                </svg>
              </div>
              <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Actions prioritaires */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Actions prioritaires</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

            {/* Demandes reçues */}
            <Link href="/dashboard/venue/demandes" className="group bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                {demandesNonLues > 0 && (
                  <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{demandesNonLues}</span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">Demandes reçues</p>
              <p className="text-xs text-gray-500 mt-0.5">Consultez et répondez aux appels d&apos;offres</p>
            </Link>

            {/* Devis & Facturation */}
            <Link href="/dashboard/venue/devis" className="group bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                </div>
                {devis.filter(d => d.statut === 'EN_ATTENTE').length > 0 && (
                  <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
                    {devis.filter(d => d.statut === 'EN_ATTENTE').length}
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">Devis & Facturation</p>
              <p className="text-xs text-gray-500 mt-0.5">Devis, acomptes et factures Chorus Pro</p>
            </Link>

            {/* Planning */}
            <Link href="/dashboard/venue/planning" className="group bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 hover:border-[var(--color-primary)] hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H18v-.008zm0 2.25h.008v.008H18V15z" />
                  </svg>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">Planning</p>
              <p className="text-xs text-gray-500 mt-0.5">Séjours et disponibilités</p>
            </Link>

          </div>
        </div>

        {/* Séjours en convention */}
        {sejoursConvention.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Séjours en convention</h2>
            <div className="space-y-3">
              {sejoursConvention.map((s: any) => (
                <div key={s.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{s.titre}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {s.lieu} &middot; {new Date(s.dateDebut).toLocaleDateString('fr-FR')} &rarr; {new Date(s.dateFin).toLocaleDateString('fr-FR')} &middot; {s.placesTotales} élèves
                    </p>
                  </div>
                  <Link
                    href={`/dashboard/sejour/${s.id}`}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    Espace collaboratif
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Configuration */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Configuration</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: '/dashboard/venue/devis', label: 'Devis & Facturation', desc: 'Devis, acomptes, Chorus Pro', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z', color: 'text-blue-500 bg-blue-50' },
              { href: '/dashboard/venue/catalogue', label: 'Catalogue', desc: 'Prestations réutilisables', icon: 'M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z', color: 'text-teal-500 bg-teal-50' },
              { href: '/dashboard/venue/documents', label: 'Documents', desc: 'Conformité', icon: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z', color: 'text-orange-500 bg-orange-50' },
              { href: '/dashboard/venue/abonnement', label: 'Abonnement', desc: 'Gérer mon offre', icon: 'M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 005.25 21z', color: 'text-yellow-500 bg-yellow-50' },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="group bg-white rounded-xl border border-gray-200 px-4 py-3 hover:border-[var(--color-primary)] hover:shadow-sm transition-all">
                <div className={`w-8 h-8 rounded-lg ${item.color} flex items-center justify-center mb-2`}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-gray-900 group-hover:text-[var(--color-primary)]">{item.label}</p>
                <p className="text-xs text-gray-400">{item.desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Profil centre */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Mon établissement</h2>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 flex items-start gap-5">
            <div className="relative shrink-0">
              {centre?.imageUrl ? (
                <img src={centre.imageUrl} alt={centre.nom} className="w-20 h-20 rounded-xl object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 text-2xl font-bold">
                  {centre?.nom?.[0] ?? 'H'}
                </div>
              )}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white shadow-sm hover:opacity-90"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </div>
            <div className="flex-1 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-400">Nom</p>
                <p className="font-medium text-gray-900">{centre?.nom}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Ville</p>
                <p className="font-medium text-gray-900">{centre?.ville}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Capacité</p>
                <p className="font-medium text-gray-900">{centre?.capacite} lits</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Téléphone</p>
                <p className="font-medium text-gray-900">{centre?.telephone ?? '—'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-400">Adresse</p>
                <p className="font-medium text-gray-900">{centre?.adresse}</p>
              </div>
            </div>
          </div>
        </div>

      </main>
    </div>
  );
}
