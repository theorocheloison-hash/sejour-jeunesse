'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';

interface ClaimEnAttente {
  id: string;
  claimStatut: string;
  claimDocumentUrl: string | null;
  claimSubmittedAt: string | null;
  user: { id: string; prenom: string; nom: string; email: string };
  organisation: {
    id: string;
    nom: string;
    siren: string | null;
    siret: string | null;
    adresse: string | null;
    ville: string | null;
    codePostal: string | null;
    centresHebergement: { id: string; nom: string }[];
  };
}

interface CentrePending {
  id: string;
  nom: string;
  ville: string | null;
  claimDocumentUrl: string | null;
  claimSubmittedAt: string | null;
  user: { id: string; prenom: string; nom: string; email: string } | null;
  organisation: { id: string; nom: string; siren: string | null } | null;
}

const ANNUAIRE_BASE = 'https://annuaire-entreprises.data.gouv.fr';
function annuaireHref(siren: string | null | undefined): string | null {
  return siren ? `${ANNUAIRE_BASE}/entreprise/${siren}` : null;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function AdminClaimsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [claims, setClaims] = useState<ClaimEnAttente[]>([]);
  const [centres, setCentres] = useState<CentrePending[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'ADMIN')) router.replace('/login');
  }, [isLoading, user, router]);

  const loadClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [claimsRes, centresRes] = await Promise.all([
        api.get<ClaimEnAttente[]>('/admin/claims'),
        api.get<CentrePending[]>('/admin/centres/pending'),
      ]);
      setClaims(claimsRes.data);
      setCentres(centresRes.data);
    } catch {
      setError('Impossible de charger la liste des claims');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'ADMIN') loadClaims();
  }, [user, loadClaims]);

  const handleValider = async (id: string) => {
    if (!confirm('Valider ce claim ? L\'hébergeur sera notifié et son compte sera activé.')) return;
    setActionId(id);
    try {
      await api.patch(`/admin/claims/${id}/valider`);
      await loadClaims();
    } catch {
      setError('Erreur lors de la validation');
    } finally {
      setActionId(null);
    }
  };

  const handleRefuser = async (id: string) => {
    const motif = prompt('Motif du refus (sera transmis à l\'hébergeur) :');
    if (motif === null) return;
    setActionId(id);
    try {
      await api.patch(`/admin/claims/${id}/refuser`, { motif: motif || 'Document non conforme' });
      await loadClaims();
    } catch {
      setError('Erreur lors du refus');
    } finally {
      setActionId(null);
    }
  };

  const handleActiverCentre = async (id: string) => {
    if (!confirm('Activer ce centre ? L\'hébergeur sera notifié.')) return;
    setActionId(id);
    try {
      await api.patch(`/admin/centres/${id}/activer`);
      await loadClaims();
    } catch {
      setError('Erreur lors de l\'activation du centre');
    } finally {
      setActionId(null);
    }
  };

  const handleRefuserCentre = async (id: string) => {
    if (!confirm('Refuser ce centre ? Il sera suspendu.')) return;
    setActionId(id);
    try {
      await api.patch(`/centres/admin/pending/${id}`, { action: 'SUSPENDED' });
      await loadClaims();
    } catch {
      setError('Erreur lors du refus du centre');
    } finally {
      setActionId(null);
    }
  };

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/admin" className="text-sm text-gray-500 hover:text-gray-900">
            ← Admin
          </Link>
          <span className="text-gray-300">/</span>
          <p className="text-sm font-semibold text-gray-900">Claims hébergeurs</p>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Claims en attente de validation</h1>
          <p className="mt-1 text-sm text-gray-500">
            Revendications hébergeur. Un claim sans justificatif (en attente de document)
            n&apos;est pas validable tant que l&apos;hébergeur n&apos;a pas fourni de document.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-500">Chargement…</p>
        ) : (
          <div className="space-y-10">
          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Nouveaux comptes à valider</h2>
            {claims.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
                <p className="text-sm text-gray-500">Aucun compte en attente</p>
              </div>
            ) : (
            <div className="space-y-4">
            {claims.map((claim) => {
              const enAttenteDoc = claim.claimStatut === 'EN_ATTENTE_DOCUMENT';
              return (
              <div key={claim.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-gray-900">{claim.organisation.nom}</h2>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${enAttenteDoc ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                        {enAttenteDoc ? 'En attente de document' : 'À valider'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                      {claim.organisation.siren && (
                        <p>
                          <span className="font-medium">SIREN :</span> {claim.organisation.siren}
                          {claim.organisation.siret && (
                            <span className="ml-3">
                              <span className="font-medium">SIRET :</span> {claim.organisation.siret}
                            </span>
                          )}
                        </p>
                      )}
                      {(claim.organisation.adresse || claim.organisation.ville) && (
                        <p>
                          {[
                            claim.organisation.adresse,
                            claim.organisation.codePostal,
                            claim.organisation.ville,
                          ]
                            .filter(Boolean)
                            .join(' — ')}
                        </p>
                      )}
                      {annuaireHref(claim.organisation.siren) ? (
                        <a
                          href={annuaireHref(claim.organisation.siren)!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--color-primary)] hover:underline"
                        >
                          Vérifier sur l&apos;annuaire des entreprises ↗
                        </a>
                      ) : (
                        <span className="text-gray-400">SIREN non renseigné</span>
                      )}
                    </div>

                    {claim.organisation.centresHebergement.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-gray-700 mb-1">Centres rattachés :</p>
                        <ul className="text-xs text-gray-600 list-disc pl-5 space-y-0.5">
                          {claim.organisation.centresHebergement.map((c) => (
                            <li key={c.id}>{c.nom}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">
                        <span className="font-medium text-gray-700">Hébergeur :</span>{' '}
                        {claim.user.prenom} {claim.user.nom} —{' '}
                        <a href={`mailto:${claim.user.email}`} className="text-[var(--color-primary)] hover:underline">
                          {claim.user.email}
                        </a>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        <span className="font-medium text-gray-700">Soumis le :</span>{' '}
                        {formatDate(claim.claimSubmittedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    {claim.claimDocumentUrl ? (
                      <a
                        href={claim.claimDocumentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Voir le justificatif
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Aucun document</span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleValider(claim.id)}
                      disabled={actionId === claim.id || enAttenteDoc}
                      title={enAttenteDoc ? 'En attente du justificatif de l\'hébergeur' : undefined}
                      className="inline-flex items-center justify-center rounded-lg bg-[var(--color-success)] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {actionId === claim.id ? '…' : enAttenteDoc ? 'Document requis' : 'Valider'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRefuser(claim.id)}
                      disabled={actionId === claim.id}
                      className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      Refuser
                    </button>
                  </div>
                </div>
              </div>
            );
            })}
            </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-3">Nouveaux centres à valider</h2>
            {centres.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 text-center">
                <p className="text-sm text-gray-500">Aucun centre en attente</p>
              </div>
            ) : (
              <div className="space-y-4">
                {centres.map((c) => {
                  const href = annuaireHref(c.organisation?.siren);
                  return (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {c.nom}{c.ville ? ` — ${c.ville}` : ''}
                          </h3>
                          <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                            {c.organisation?.nom && (
                              <p><span className="font-medium">Organisation :</span> {c.organisation.nom}</p>
                            )}
                            {href ? (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--color-primary)] hover:underline">
                                Vérifier sur l&apos;annuaire des entreprises ↗
                              </a>
                            ) : (
                              <span className="text-gray-400">SIREN non renseigné</span>
                            )}
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            {c.user && (
                              <p className="text-xs text-gray-500">
                                <span className="font-medium text-gray-700">Hébergeur :</span>{' '}
                                {c.user.prenom} {c.user.nom} —{' '}
                                <a href={`mailto:${c.user.email}`} className="text-[var(--color-primary)] hover:underline">{c.user.email}</a>
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-0.5">
                              <span className="font-medium text-gray-700">Soumis le :</span> {formatDate(c.claimSubmittedAt)}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 shrink-0">
                          {c.claimDocumentUrl ? (
                            <a href={c.claimDocumentUrl} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50">
                              Voir le justificatif
                            </a>
                          ) : (
                            <span className="text-xs text-gray-400">Aucun document — en attente</span>
                          )}
                          <button type="button" onClick={() => handleActiverCentre(c.id)} disabled={actionId === c.id}
                            className="inline-flex items-center justify-center rounded-lg bg-[var(--color-success)] px-3 py-2 text-xs font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60">
                            {actionId === c.id ? '…' : 'Activer le centre'}
                          </button>
                          <button type="button" onClick={() => handleRefuserCentre(c.id)} disabled={actionId === c.id}
                            className="inline-flex items-center justify-center rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60">
                            Refuser
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          </div>
        )}
      </main>
    </div>
  );
}
