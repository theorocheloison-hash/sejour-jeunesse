'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, extractApiError } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';
import { Logo } from '@/app/components/Logo';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KBIS_MAX_BYTES = 10 * 1024 * 1024;

type Etape = 'auth' | 'loading' | 'claim' | 'kbis' | 'done' | 'error';

function ClaimCentreContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [centreInfo, setCentreInfo] = useState<{ nom: string; ville: string; capacite: number } | null>(null);
  const [organisationId, setOrganisationId] = useState<string | null>(null);
  const [, setResolvedCentreId] = useState<string | null>(null);

  const [etape, setEtape] = useState<Etape>('loading');
  const [kbisFile, setKbisFile] = useState<File | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;

    if (!user || user.role !== 'HEBERGEUR') {
      setEtape('auth');
      return;
    }

    const isUuid = UUID_REGEX.test(id);
    if (isUuid) {
      api.get(`/public/centres/${id}`)
        .then(({ data }) => {
          if (!data) { setEtape('error'); setError('Centre introuvable'); return; }
          if (data.isClaimed) {
            setEtape('error');
            setError('Ce centre est déjà revendiqué par un autre hébergeur.');
            return;
          }
          setCentreInfo({ nom: data.nom, ville: data.ville, capacite: data.capacite });
          setOrganisationId(data.organisationId ?? null);
          setResolvedCentreId(id);
          if (!data.organisationId) {
            setEtape('error');
            setError('Ce centre n\'est pas associé à une organisation. Contactez le support.');
            return;
          }
          setEtape('claim');
        })
        .catch(() => { setEtape('error'); setError('Impossible de charger le centre'); });
    } else {
      const nom = searchParams.get('nom') ?? '';
      const ville = searchParams.get('ville') ?? '';
      const codePostal = searchParams.get('codePostal') ?? '';
      const capacite = parseInt(searchParams.get('capacite') ?? '0', 10);
      const departement = searchParams.get('departement');

      if (!nom || !ville) {
        setEtape('error');
        setError('Informations du centre manquantes. Retournez au catalogue.');
        return;
      }

      api.post<{ centreId: string; organisationId: string }>('/centres/materialiser-en', {
        identifiantEN: id, nom, ville, codePostal, capacite, departement,
      })
        .then(({ data }) => {
          setCentreInfo({ nom, ville, capacite });
          setOrganisationId(data.organisationId);
          setResolvedCentreId(data.centreId);
          setEtape('claim');
        })
        .catch(() => { setEtape('error'); setError('Erreur lors de l\'enregistrement du centre'); });
    }
  }, [id, isLoading, user, searchParams]);

  const handleClaim = async () => {
    if (!organisationId) return;
    setIsPending(true);
    setError(null);
    try {
      const { data } = await api.post<{ kbisRequis: boolean; alreadyPending?: boolean }>(`/organisations/${organisationId}/claim`);
      if (data.alreadyPending) {
        setMessage('Un claim est déjà en cours pour ce centre.');
        setEtape('done');
        return;
      }
      if (data.kbisRequis) {
        setEtape('kbis');
      } else {
        setEtape('done');
      }
    } catch (err: unknown) {
      const msg = extractApiError(err);
      if (msg.includes('propriétaire validé')) {
        setError('Ce centre est déjà revendiqué par un autre hébergeur.');
      } else {
        setError(msg);
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleKbisChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setKbisFile(null);
      return;
    }
    if (file.type !== 'application/pdf') {
      setError('Le fichier doit être un PDF.');
      return;
    }
    if (file.size > KBIS_MAX_BYTES) {
      setError('Le fichier dépasse 10 Mo.');
      return;
    }
    setError(null);
    setKbisFile(file);
  };

  const handleKbisUpload = async () => {
    if (!kbisFile || !organisationId) return;
    setIsPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', kbisFile);
      await api.post(`/organisations/${organisationId}/upload-kbis`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEtape('done');
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">

        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-4">
            <Logo size="sm" showTagline={false} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Revendiquer ce centre</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">

          {error && (
            <div role="alert" className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {etape === 'loading' && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
            </div>
          )}

          {etape === 'auth' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                Pour revendiquer ce centre, vous devez avoir un compte hébergeur sur LIAVO.
              </p>
              <Link
                href={`/login?redirect=${encodeURIComponent(`/centre/${id}/claim`)}`}
                className="block w-full text-center rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                Me connecter
              </Link>
              <Link
                href="/register/hebergeur"
                className="block w-full text-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Créer un compte hébergeur
              </Link>
            </div>
          )}

          {etape === 'claim' && centreInfo && (
            <div className="space-y-5">
              <div className="rounded-lg bg-[var(--color-primary-light)] border border-[var(--color-border-strong)] px-4 py-3">
                <p className="text-sm font-semibold text-[var(--color-primary)]">{centreInfo.nom}</p>
                <p className="text-xs text-[var(--color-primary)]/70 mt-0.5">
                  {centreInfo.ville}{centreInfo.capacite ? ` — ${centreInfo.capacite} lits` : ''}
                </p>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed">
                Revendiquer ce centre vous permettra de gérer ses disponibilités, recevoir des
                demandes de devis et créer des devis pour les organisateurs.
              </p>
              <p className="text-xs text-gray-500">
                Un justificatif Kbis peut être requis si ce centre a déjà des données enrichies en base.
              </p>

              <button
                type="button"
                onClick={handleClaim}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Envoi…</>
                ) : (
                  'Revendiquer ce centre'
                )}
              </button>

              <Link href="/catalogue" className="block text-center text-xs text-gray-500 hover:underline">
                ← Retour au catalogue
              </Link>
            </div>
          )}

          {etape === 'kbis' && (
            <div className="space-y-4">
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                Un Kbis est requis pour valider votre propriété de ce centre.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Justificatif Kbis (PDF, 10 Mo max)
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleKbisChange}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-lg file:border-0 file:bg-[var(--color-primary)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:opacity-90"
                />
                {kbisFile && (
                  <p className="mt-2 text-xs text-gray-500">
                    {kbisFile.name} — {(kbisFile.size / 1024 / 1024).toFixed(2)} Mo
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleKbisUpload}
                disabled={!kbisFile || isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isPending ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Envoi…</>
                ) : (
                  'Envoyer le Kbis'
                )}
              </button>
            </div>
          )}

          {etape === 'done' && (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--color-success-light)]">
                <svg className="w-7 h-7 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Demande envoyée</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                {message ?? 'Votre demande a été envoyée. Notre équipe la traitera sous 48h. Vous recevrez un email de confirmation.'}
              </p>
              <button
                type="button"
                onClick={() => router.push('/dashboard/hebergeur')}
                className="w-full rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
              >
                Accéder à mon espace
              </button>
            </div>
          )}

          {etape === 'error' && (
            <div className="space-y-4 text-center">
              <p className="text-sm text-gray-600">{error ?? 'Une erreur est survenue.'}</p>
              <Link
                href="/catalogue"
                className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                ← Retour au catalogue
              </Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ClaimCentrePage() {
  return (
    <Suspense>
      <ClaimCentreContent />
    </Suspense>
  );
}
