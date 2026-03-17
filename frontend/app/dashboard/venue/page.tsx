'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { useNotifications } from '@/src/hooks/useNotifications';
import { getMonProfil, uploadCentreImage } from '@/src/lib/centre';
import { getAbonnementStatut } from '@/src/lib/abonnement';
import { getMesSejoursConvention } from '@/src/lib/collaboration';
import type { Centre } from '@/src/lib/centre';
import type { AbonnementStatut } from '@/src/lib/abonnement';
import type { SejourConventionVenue } from '@/src/lib/collaboration';

const STATUT_BADGE: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: 'En attente',  cls: 'bg-orange-100 text-orange-700' },
  ACTIVE:    { label: 'Actif',       cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  SUSPENDED: { label: 'Suspendu',    cls: 'bg-red-100 text-red-700' },
};

const SECTIONS = [
  {
    title: 'Disponibilités',
    desc: 'Gérez vos périodes d\'accueil et capacités disponibles',
    href: '/dashboard/venue/disponibilites',
    icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
    color: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]',
  },
  {
    title: 'Documents de conformité',
    desc: 'Agréments, assurances et autres documents officiels',
    href: '/dashboard/venue/documents',
    icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
    color: 'bg-[var(--color-success-light)] text-[var(--color-success)]',
  },
  {
    title: 'Demandes des enseignants',
    desc: 'Consultez et répondez aux demandes reçues',
    href: '/dashboard/venue/demandes',
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    title: 'Devis envoyés',
    desc: 'Suivez vos propositions et devis en cours',
    href: '/dashboard/venue/devis',
    icon: 'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    title: 'Abonnement',
    desc: 'Gérez votre abonnement pour accéder aux demandes',
    href: '/dashboard/venue/abonnement',
    icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
    color: 'bg-yellow-100 text-yellow-600',
  },
  {
    title: 'Inviter un enseignant',
    desc: 'Créez un séjour directement avec un enseignant partenaire',
    href: '/dashboard/venue/inviter-enseignant',
    icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
    color: 'bg-amber-100 text-amber-600',
  },
];

export default function VenueDashboard() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [centre, setCentre] = useState<Centre | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [abo, setAbo] = useState<AbonnementStatut | null>(null);
  const [sejoursConvention, setSejoursConvention] = useState<SejourConventionVenue[]>([]);
  const notifs = useNotifications(user?.role === 'VENUE');

  const badgeMap: Record<string, number> = {
    '/dashboard/venue/demandes': notifs.demandes,
    '/dashboard/venue/devis': notifs.devisAcceptes,
  };

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'VENUE')) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user?.role === 'VENUE') {
      getMonProfil().then(setCentre).catch(() => {});
      getAbonnementStatut().then(setAbo).catch(() => {});
      getMesSejoursConvention().then(setSejoursConvention).catch(() => {});
    }
  }, [user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const updated = await uploadCentreImage(file);
      setCentre(updated);
    } catch {
      // ignore
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isLoading || !user) return null;

  const statut = STATUT_BADGE[centre?.statut ?? 'PENDING'] ?? STATUT_BADGE.PENDING;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)]">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
                </svg>
              </div>
              <div>
                <span className="font-semibold text-gray-900">{centre?.nom ?? 'Mon centre'}</span>
                <span className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statut.cls}`}>{statut.label}</span>
              </div>
            </div>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Tableau de bord</h1>
        <p className="text-sm text-gray-500 mb-8">Gérez votre centre d'hébergement</p>

        {centre && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-8">
            {centre.imageUrl ? (
              <img src={centre.imageUrl} alt={centre.nom} className="w-full h-48 object-cover rounded-xl mb-4" />
            ) : (
              <div className="h-48 bg-gray-100 rounded-xl mb-4 flex items-center justify-center">
                <svg className="h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/jpeg,image/png,image/webp" className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
              className="mb-4 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60">
              {uploading ? 'Upload...' : centre.imageUrl ? 'Changer la photo' : 'Ajouter une photo'}
            </button>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-500">Ville</span><p className="font-medium text-gray-900">{centre.ville}</p></div>
              <div><span className="text-gray-500">Capacité</span><p className="font-medium text-gray-900">{centre.capacite} lits</p></div>
              <div><span className="text-gray-500">Adresse</span><p className="font-medium text-gray-900">{centre.adresse}</p></div>
              <div><span className="text-gray-500">Téléphone</span><p className="font-medium text-gray-900">{centre.telephone ?? '—'}</p></div>
            </div>
          </div>
        )}

        {abo && abo.statut !== 'ACTIF' && (
          <div className="mb-6 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800 flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Abonnement inactif — <Link href="/dashboard/venue/abonnement" className="font-semibold underline hover:text-yellow-900">Activer votre abonnement</Link> pour accéder aux demandes des enseignants.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SECTIONS.map((s) => {
            const badge = badgeMap[s.href] ?? 0;
            return (
              <Link
                key={s.title}
                href={s.href}
                className="relative bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-[var(--color-border-strong)] transition-all group"
              >
                {badge > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {badge}
                  </span>
                )}
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${s.color}`}>
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d={s.icon} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 group-hover:text-[var(--color-primary)] transition-colors">
                      {s.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">{s.desc}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── Séjours en convention ──────────────────────────────────────── */}
        {sejoursConvention.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Mes séjours en convention</h2>
            <div className="space-y-3">
              {sejoursConvention.map((s) => {
                const dateDebut = new Date(s.dateDebut).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
                const dateFin = new Date(s.dateFin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{s.titre}</h3>
                        <span className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">Convention</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                        <span>{s.lieu}</span>
                        <span>{dateDebut} &rarr; {dateFin}</span>
                        <span>{s.placesTotales} élève{s.placesTotales > 1 ? 's' : ''}</span>
                        {s.createur && <span>Enseignant : {s.createur.prenom} {s.createur.nom}</span>}
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/sejour/${s.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors shrink-0"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8z" />
                      </svg>
                      Espace collaboratif
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
