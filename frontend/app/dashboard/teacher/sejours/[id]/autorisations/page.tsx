'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  createAutorisation,
  getAutorisationsBySejour,
  type AutorisationParentale,
} from '@/src/lib/autorisation';

export default function GestionAutorisationsPage() {
  const { id: sejourId } = useParams<{ id: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [autorisations, setAutorisations] = useState<AutorisationParentale[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Formulaire
  const [eleveNom, setEleveNom] = useState('');
  const [elevePrenom, setElevePrenom] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Copie lien
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !user) router.replace('/login');
  }, [isLoading, user, router]);

  const loadAutorisations = useCallback(async () => {
    if (!sejourId) return;
    try {
      const data = await getAutorisationsBySejour(sejourId);
      setAutorisations(data);
    } catch {
      setLoadError('Impossible de charger les autorisations.');
    }
  }, [sejourId]);

  useEffect(() => {
    if (user && sejourId) loadAutorisations();
  }, [user, sejourId, loadAutorisations]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sejourId) return;
    setCreating(true);
    setCreateError(null);
    try {
      await createAutorisation({
        sejourId,
        eleveNom: eleveNom.trim(),
        elevePrenom: elevePrenom.trim(),
        parentEmail: parentEmail.trim(),
      });
      setEleveNom('');
      setElevePrenom('');
      setParentEmail('');
      await loadAutorisations();
    } catch {
      setCreateError("Erreur lors de la création de l'autorisation.");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (tokenAcces: string, id: string) => {
    const url = `${window.location.origin}/autorisation/${tokenAcces}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Séjour Jeunesse</span>
            </div>
            <Link
              href="/dashboard/teacher"
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
            >
              ← Retour au tableau de bord
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Autorisations parentales
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Ajoutez les élèves et envoyez les liens de signature aux parents.
        </p>

        {/* ── Formulaire d'ajout ───────────────────────────────── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Ajouter un élève
          </h2>

          {createError && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {createError}
            </div>
          )}

          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Prénom"
              value={elevePrenom}
              onChange={(e) => setElevePrenom(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <input
              type="text"
              placeholder="Nom"
              value={eleveNom}
              onChange={(e) => setEleveNom(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <input
              type="email"
              placeholder="Email du parent"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {creating ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>
        </div>

        {/* ── Liste des autorisations ──────────────────────────── */}
        {loadError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        {autorisations.length > 0 ? (
          <div className="space-y-3">
            {autorisations.map((a) => {
              const isSigned = !!a.signeeAt;
              return (
                <div
                  key={a.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  {/* Infos élève */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900">
                        {a.elevePrenom} {a.eleveNom}
                      </span>
                      {isSigned ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">
                          Signé le{' '}
                          {new Date(a.signeeAt!).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2.5 py-0.5 text-xs font-medium">
                          En attente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{a.parentEmail}</p>
                  </div>

                  {/* Bouton copier le lien */}
                  <button
                    type="button"
                    onClick={() => copyLink(a.tokenAcces, a.id)}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
                  >
                    {copiedId === a.id ? (
                      <>
                        <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-green-600">Copié !</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copier le lien
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          !loadError && (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-12 text-center">
              <p className="text-sm text-gray-500">
                Aucune autorisation pour ce séjour. Ajoutez un élève ci-dessus.
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
}
