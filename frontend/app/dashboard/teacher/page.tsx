'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesSejours, updateSejourStatus } from '@/src/lib/sejour';
import type { Sejour, StatutSejour } from '@/src/lib/sejour';

// ─── Badge statut ───────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<StatutSejour, { label: string; cls: string }> = {
  DRAFT:      { label: 'Brouillon',   cls: 'bg-gray-100 text-gray-600' },
  SUBMITTED:  { label: 'Soumis',      cls: 'bg-orange-100 text-orange-700' },
  APPROVED:   { label: 'Approuvé',    cls: 'bg-green-100 text-green-700' },
  REJECTED:   { label: 'Refusé',      cls: 'bg-red-100 text-red-700' },
  CONVENTION: { label: 'Convention',   cls: 'bg-indigo-100 text-indigo-700' },
};

function StatutBadge({ statut }: { statut: StatutSejour }) {
  const { label, cls } = STATUT_CONFIG[statut] ?? STATUT_CONFIG.DRAFT;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ─── Carte séjour ───────────────────────────────────────────────────────────

function SejourCard({
  sejour,
  onSubmit,
  isSubmitting,
}: {
  sejour: Sejour;
  onSubmit: (id: string) => void;
  isSubmitting: boolean;
}) {
  const dateDebut = new Date(sejour.dateDebut).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
  const dateFin = new Date(sejour.dateFin).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      {/* Infos principales */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{sejour.titre}</h3>
          <StatutBadge statut={sejour.statut} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>{sejour.lieu}</span>
          <span>{dateDebut} → {dateFin}</span>
          <span>{sejour.placesTotales} élève{sejour.placesTotales > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-2 flex-wrap">
        {/* Bouton soumettre — uniquement pour DRAFT */}
        {sejour.statut === 'DRAFT' && (
          <button
            type="button"
            onClick={() => onSubmit(sejour.id)}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
          >
            {isSubmitting ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            )}
            Soumettre au directeur
          </button>
        )}

        {/* Appel d'offres — pour SUBMITTED et APPROVED */}
        {(sejour.statut === 'SUBMITTED' || sejour.statut === 'APPROVED') && sejour.demandes && sejour.demandes.length > 0 && (() => {
          const totalDevis = sejour.demandes.reduce((sum, d) => sum + (d._count?.devis ?? 0), 0);
          return (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                Appel d&apos;offres ouvert &middot; {totalDevis} devis
              </span>
              {sejour.dateButoireDevis && (
                <span className="text-xs text-gray-400">
                  avant le {new Date(sejour.dateButoireDevis).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                </span>
              )}
              <Link
                href={`/dashboard/teacher/sejours/${sejour.id}/offres`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
              >
                Voir les offres
              </Link>
            </div>
          );
        })()}

        {/* Bouton autorisations — uniquement pour APPROVED */}
        {sejour.statut === 'APPROVED' && (
          <Link
            href={`/dashboard/teacher/sejours/${sejour.id}/autorisations`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Gérer les autorisations
          </Link>
        )}

        {/* Espace collaboratif — uniquement pour CONVENTION */}
        {sejour.statut === 'CONVENTION' && (() => {
          const devisSelectionne = sejour.demandes
            ?.flatMap((d) => d.devis ?? [])
            .find((dv) => dv.statut === 'SELECTIONNE');
          return (
            <>
              {devisSelectionne?.typeDocument === 'FACTURE_ACOMPTE' && (
                <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <span className="font-semibold text-amber-800">
                      Facture d&apos;acompte {devisSelectionne.numeroFacture}
                    </span>
                    {devisSelectionne.centre?.nom && (
                      <span className="text-amber-700">{devisSelectionne.centre.nom}</span>
                    )}
                    <span className="text-amber-700">
                      Acompte ({devisSelectionne.pourcentageAcompte ?? 30}%) :{' '}
                      <span className="font-bold">
                        {Number(devisSelectionne.montantAcompte ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR
                      </span>
                    </span>
                    <span className="text-amber-600">
                      Total TTC : {Number(devisSelectionne.montantTTC ?? devisSelectionne.montantTotal).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} EUR
                    </span>
                  </div>
                </div>
              )}
              <Link
                href={`/dashboard/sejour/${sejour.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8z" />
                </svg>
                Espace collaboratif
              </Link>
              <Link
                href={`/dashboard/teacher/documents/${sejour.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Documents officiels
              </Link>
            </>
          );
        })()}
      </div>
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  const [sejours, setSejours] = useState<Sejour[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  const loadSejours = useCallback(async () => {
    try {
      const data = await getMesSejours();
      setSejours(data);
    } catch {
      setLoadError('Impossible de charger les séjours.');
    }
  }, []);

  useEffect(() => {
    if (user) loadSejours();
  }, [user, loadSejours]);

  const handleSubmit = async (id: string) => {
    setSubmittingId(id);
    try {
      await updateSejourStatus(id, 'SUBMITTED');
      await loadSejours();
    } catch {
      // silently ignore — the list will remain unchanged
    } finally {
      setSubmittingId(null);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Barre de navigation ────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">

            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Séjour Jeunesse</span>
            </div>

            {/* User + profil + logout */}
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/teacher/profil"
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                  <span className="text-xs font-semibold text-indigo-700">{initials}</span>
                </div>
                <div className="hidden sm:block leading-tight">
                  <p className="text-sm font-medium text-gray-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-gray-500">Enseignant</p>
                </div>
              </Link>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Se déconnecter
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Contenu principal ──────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* En-tête de page */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mes séjours</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gérez et suivez vos séjours pédagogiques
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard/teacher/demandes"
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Mes demandes de devis
            </Link>
            <Link
              href="/dashboard/teacher/nouveau-sejour"
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Créer un nouveau séjour
            </Link>
          </div>
        </div>

        {/* Erreur de chargement */}
        {loadError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {/* Liste ou état vide */}
        {sejours.length > 0 ? (
          <div className="space-y-3">
            {sejours.map((s) => (
              <SejourCard
                key={s.id}
                sejour={s}
                onSubmit={handleSubmit}
                isSubmitting={submittingId === s.id}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-50">
              <svg className="h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
            </div>
            <h2 className="mt-4 text-base font-semibold text-gray-900">Aucun séjour créé</h2>
            <p className="mt-1 text-sm text-gray-500">
              Commencez par créer votre premier séjour pédagogique.
            </p>
            <Link
              href="/dashboard/teacher/nouveau-sejour"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Créer un nouveau séjour
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
