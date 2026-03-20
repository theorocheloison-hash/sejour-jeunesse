'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getDossierPedagogique, soumettreAuDirecteur } from '@/src/lib/sejour';
import type { DossierPedagogiqueData, ChecklistItem } from '@/src/lib/sejour';

export default function DocumentsOfficielsPage() {
  const { sejourId } = useParams<{ sejourId: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [dossier, setDossier] = useState<DossierPedagogiqueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [manualChecks, setManualChecks] = useState({
    transport: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'TEACHER')) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  const loadDossier = useCallback(async () => {
    if (!sejourId) return;
    setLoading(true);
    try {
      setDossier(await getDossierPedagogique(sejourId));
    } catch {
      setError('Impossible de charger les données du séjour.');
    } finally {
      setLoading(false);
    }
  }, [sejourId]);

  useEffect(() => {
    if (user?.role === 'TEACHER') loadDossier();
  }, [user, loadDossier]);

  const handleSoumettre = async () => {
    if (!sejourId) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const result = await soumettreAuDirecteur(sejourId);
      setSubmitResult(result);
    } catch (err: any) {
      setSubmitResult({ success: false, message: err?.response?.data?.message ?? 'Erreur lors de l\'envoi' });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !user) return null;

  const checklist: ChecklistItem[] = dossier ? [
    {
      id: 'convention',
      label: 'Convention d\'hébergement',
      checked: !!dossier.hebergementSelectionne,
      auto: true,
      description: dossier.hebergementSelectionne
        ? `Convention avec ${dossier.hebergementSelectionne.nom}`
        : 'Aucun hébergeur sélectionné',
    },
    {
      id: 'autorisations',
      label: 'Autorisations parentales complètes',
      checked: dossier._count.autorisations > 0 && dossier.autorisations.every((a) => a.signeeAt !== null),
      auto: true,
      description: `${dossier.autorisations.filter((a) => a.signeeAt).length}/${dossier._count.autorisations} signées`,
    },
    {
      id: 'accompagnateurs',
      label: 'Ordres de mission accompagnateurs',
      checked: dossier.accompagnateurs.length > 0 && dossier.accompagnateurs.some((a) => a.signeeAt !== null),
      auto: true,
      description: `${dossier.accompagnateurs.filter((a) => a.signeeAt).length}/${dossier.accompagnateurs.length} signés`,
    },
    {
      id: 'planning',
      label: 'Programme détaillé jour par jour',
      checked: dossier.planningActivites.length > 0,
      auto: true,
      description: dossier.planningActivites.length
        ? `${dossier.planningActivites.length} activité(s) planifiée(s)`
        : 'Aucune activité planifiée',
    },
    {
      id: 'projet_peda',
      label: 'Projet pédagogique',
      checked: (dossier.thematiquesPedagogiques?.length ?? 0) > 0,
      auto: true,
      description: (dossier.thematiquesPedagogiques?.length ?? 0) > 0
        ? `${dossier.thematiquesPedagogiques.length} thématique(s) renseignée(s)`
        : 'Aucune thématique pédagogique renseignée',
    },
    {
      id: 'transport',
      label: 'Convention de transport',
      checked: manualChecks.transport,
      auto: false,
      description: 'Document à uploader dans les documents du séjour',
    },
    {
      id: 'budget',
      label: 'Budget prévisionnel',
      checked: (dossier.lignesBudget?.length ?? 0) > 0 || (dossier.demandes?.[0]?.devis?.[0]?.lignes?.length ?? 0) > 0,
      auto: true,
      description: (dossier.lignesBudget?.length ?? 0) > 0 || (dossier.demandes?.[0]?.devis?.[0]?.lignes?.length ?? 0) > 0
        ? 'Budget renseigné'
        : 'Aucune donnée budgétaire',
    },
  ] : [];

  const score = checklist.filter((i) => i.checked).length;
  const total = checklist.length;
  const pct = total > 0 ? Math.round((score / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/teacher" className="text-sm text-[var(--color-primary)] font-medium">
                &larr; Retour au tableau de bord
              </Link>
              {dossier && (
                <span className="text-sm font-semibold text-gray-900 truncate max-w-xs">{dossier.titre}</span>
              )}
            </div>
            <span className="inline-flex items-center rounded-full bg-[var(--color-primary-light)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-primary)]">
              Documents officiels
            </span>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        )}

        {!loading && dossier && (
          <div className="space-y-6">
            {/* SECTION 1 — Checklist administrative */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Checklist administrative</h2>
                <span className={`text-sm font-bold ${pct === 100 ? 'text-[var(--color-success)]' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                  {score}/{total} — {pct}%
                </span>
              </div>

              {/* Barre de progression */}
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden mb-6">
                <div
                  className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-[var(--color-success)]' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* Items */}
              <div className="space-y-3">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    {item.auto ? (
                      <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded ${item.checked ? 'bg-[var(--color-success)]' : 'bg-gray-200'}`}>
                        {item.checked && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                    ) : (
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => setManualChecks((prev) => ({ ...prev, [item.id]: !prev[item.id as keyof typeof prev] }))}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${item.checked ? 'text-gray-900' : 'text-gray-500'}`}>{item.label}</span>
                        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${item.auto ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                          {item.auto ? 'Auto' : 'Manuel'}
                        </span>
                      </div>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-0.5">{item.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* SECTION 2 — Documents à générer */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Documents à générer</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  href={`/dashboard/sejour/${sejourId}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-primary-light)] transition-all"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-light)] text-[var(--color-primary)]">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Projet pédagogique PDF</p>
                    <p className="text-xs text-gray-500">Générer depuis l&apos;espace collaboratif</p>
                  </div>
                </Link>
                <Link
                  href={`/dashboard/sejour/${sejourId}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-4 hover:border-[var(--color-border-strong)] hover:bg-[var(--color-primary-light)] transition-all"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Ordres de mission</p>
                    <p className="text-xs text-gray-500">Voir dans l&apos;espace collaboratif</p>
                  </div>
                </Link>
              </div>
            </div>

            {/* SECTION 3 — Soumettre au directeur */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="text-base font-semibold text-gray-900 mb-2">Transmettre au directeur</h2>
              <p className="text-sm text-gray-500 mb-4">
                Transmettez le dossier à votre directeur d&apos;établissement pour information. Un email sera envoyé avec un lien vers le tableau de bord directeur.
              </p>

              {submitResult && (
                <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${submitResult.success ? 'bg-[var(--color-success-light)] border border-[var(--color-success)]/20 text-[var(--color-success)]' : 'bg-red-50 border border-red-200 text-red-700'}`}>
                  {submitResult.message}
                </div>
              )}

              <button
                onClick={handleSoumettre}
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Envoi en cours...</>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    Envoyer au directeur
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
