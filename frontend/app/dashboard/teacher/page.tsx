'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMesSejours, updateSejourStatus } from '@/src/lib/sejour';
import type { Sejour, StatutSejour } from '@/src/lib/sejour';
import { Logo } from '@/app/components/Logo';

// ─── Badge statut ───────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<StatutSejour, { label: string; cls: string }> = {
  DRAFT:      { label: 'Brouillon',   cls: 'bg-gray-100 text-gray-600' },
  SUBMITTED:  { label: 'Soumis',      cls: 'bg-orange-100 text-orange-700' },
  APPROVED:   { label: 'Approuvé',    cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  REJECTED:   { label: 'Refusé',      cls: 'bg-red-100 text-red-700' },
  CONVENTION:      { label: 'Convention',        cls: 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' },
  SOUMIS_RECTORAT: { label: 'Soumis au rectorat', cls: 'bg-purple-100 text-purple-700' },
  SIGNE_DIRECTION: { label: 'Signé direction', cls: 'bg-purple-100 text-purple-700' },
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

  const devisSelectionne = ['CONVENTION', 'SIGNE_DIRECTION'].includes(sejour.statut)
    ? sejour.demandes?.flatMap((d) => d.devis ?? []).find((dv) => dv.statut === 'SELECTIONNE')
    : undefined;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-5 flex flex-col sm:flex-row sm:items-start gap-4">
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
        <div className="flex shrink-0 gap-2 flex-wrap items-center">
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
              Lancer l'appel d'offres
            </button>
          )}

          {/* Appel d'offres — pour SUBMITTED et APPROVED */}
          {sejour.statut === 'SUBMITTED' && (() => {
            const totalDevis = (sejour.demandes ?? [])
              .reduce((sum, d) => sum + (d._count?.devis ?? 0), 0);
            return (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5
                  text-xs font-medium ${totalDevis > 0
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600'}`}>
                  {totalDevis > 0
                    ? `${totalDevis} devis reçu${totalDevis > 1 ? 's' : ''}`
                    : 'En attente de devis'}
                </span>
                {sejour.dateButoireDevis && (
                  <span className="text-xs text-gray-400">
                    avant le {new Date(sejour.dateButoireDevis)
                      .toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                  </span>
                )}
                <Link
                  href={`/dashboard/teacher/sejours/${sejour.id}/offres`}
                  className="inline-flex items-center gap-1.5 rounded-lg border
                    border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold
                    text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {totalDevis > 0 ? 'Voir les offres' : 'Voir ma demande'}
                </Link>
              </div>
            );
          })()}

          {/* Badge devis signé/en attente — pour CONVENTION et SIGNE_DIRECTION */}
          {['CONVENTION', 'SIGNE_DIRECTION'].includes(sejour.statut) && (() => {
            const devisActif = sejour.demandes?.[0]?.devis?.[0];
            if (!devisActif) return null;
            const estSigne = !!(devisActif as any).signatureDirecteur;
            return (
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5
                text-xs font-medium ${estSigne
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-amber-100 text-amber-700'}`}>
                {estSigne
                  ? `Signé direction — ${devisActif.centre?.nom ?? ''}`
                  : `En attente signature — ${devisActif.centre?.nom ?? ''}`}
              </span>
            );
          })()}

          {/* Bouton autorisations — pour APPROVED et CONVENTION */}
          {(sejour.statut === 'APPROVED' || ['CONVENTION', 'SIGNE_DIRECTION'].includes(sejour.statut)) && (
            <Link
              href={`/dashboard/teacher/sejours/${sejour.id}/autorisations`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-success)] bg-[var(--color-success-light)] px-3 py-2 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success-light)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-success)] focus:ring-offset-2"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Gérer les autorisations
            </Link>
          )}

          {/* Espace collaboratif — uniquement pour CONVENTION */}
          {['CONVENTION', 'SIGNE_DIRECTION'].includes(sejour.statut) && (
            <>
              <Link
                href={`/dashboard/sejour/${sejour.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-primary-light)] px-3 py-2 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:ring-offset-2"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a2 2 0 01-2-2v-6a2 2 0 012-2h8z" />
                </svg>
                Espace collaboratif
              </Link>
              <Link
                href={`/dashboard/teacher/documents/${sejour.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-success)] bg-[var(--color-success-light)] px-3 py-2 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success-light)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-success)] focus:ring-offset-2"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Documents officiels
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Bandeau facture acompte — bloc séparé en bas de carte */}
      {devisSelectionne?.typeDocument === 'FACTURE_ACOMPTE' && (
        <div className="border-t border-amber-200 bg-amber-50 px-5 py-3">
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
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
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
              <Logo size="sm" showTagline={false} />
            </div>

            {/* User + profil + logout */}
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard/teacher/profil"
                className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-light)]">
                  <span className="text-xs font-semibold text-[var(--color-primary)]">{initials}</span>
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
        <div style={{ marginBottom: 8 }}>
          <h1 className="text-2xl font-bold text-gray-900">Mes séjours</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérez et suivez vos séjours pédagogiques
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          {/* Bouton 1 — Catalogue */}
          <a href="/dashboard/teacher/hebergements"
            style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '16px 24px', borderRadius: 'var(--radius-lg)',
              border: '0.5px solid var(--color-border)',
              background: 'var(--color-surface)',
              textDecoration: 'none', flex: 1, minWidth: 200,
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
            }}>
            <span style={{
              fontSize: 14, fontWeight: 500,
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-sans)',
            }}>
              Parcourir les 649 centres
            </span>
            <span style={{
              fontSize: 12, color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-sans)',
            }}>
              Trouvez et contactez un hébergeur directement
            </span>
          </a>

          {/* Bouton 2 — Appel d'offres */}
          <a href="/dashboard/teacher/nouveau-sejour"
            style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '16px 24px', borderRadius: 'var(--radius-lg)',
              border: '0.5px solid var(--color-border)',
              background: 'var(--color-surface)',
              textDecoration: 'none', flex: 1, minWidth: 200,
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
            }}>
            <span style={{
              fontSize: 14, fontWeight: 500,
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-sans)',
            }}>
              Lancer un appel d&apos;offres
            </span>
            <span style={{
              fontSize: 12, color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-sans)',
            }}>
              Recevez des devis de tous les centres de la destination que vous choisissez
            </span>
          </a>

          {/* Bouton 3 — Mes demandes */}
          <a href="/dashboard/teacher/demandes"
            style={{
              display: 'flex', flexDirection: 'column', gap: 4,
              padding: '16px 24px', borderRadius: 'var(--radius-lg)',
              border: '0.5px solid var(--color-border)',
              background: 'var(--color-surface)',
              textDecoration: 'none', flex: 1, minWidth: 200,
              boxShadow: 'var(--shadow-sm)',
              cursor: 'pointer',
            }}>
            <span style={{
              fontSize: 14, fontWeight: 500,
              color: 'var(--color-primary)',
              fontFamily: 'var(--font-sans)',
            }}>
              Mes demandes de devis
            </span>
            <span style={{
              fontSize: 12, color: 'var(--color-text-muted)',
              fontFamily: 'var(--font-sans)',
            }}>
              Suivez vos échanges avec les hébergeurs
            </span>
          </a>
        </div>

        {/* Erreur de chargement */}
        {loadError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {/* Liste ou état vide */}
        {sejours.length > 0 ? (
          <div className="space-y-4">
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
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--color-primary-light)]">
              <svg className="h-7 w-7 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
              </svg>
            </div>
            <h2 className="mt-4 text-base font-semibold text-gray-900">Aucun séjour créé</h2>
            <p className="mt-1 text-sm text-gray-500">
              Commencez par créer votre premier séjour pédagogique.
            </p>
            <a
              href="/dashboard/teacher/nouveau-sejour"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                marginTop: 24, fontSize: 14, fontWeight: 500,
                padding: '10px 20px', borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-primary)',
                color: '#FFFFFF', textDecoration: 'none',
              }}
            >
              Lancer un appel d&apos;offres
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" /></svg>
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
