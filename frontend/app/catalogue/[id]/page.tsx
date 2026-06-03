'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Cookies from 'js-cookie';
import api from '@/src/lib/api';
import { getHebergementPublic } from '@/src/lib/hebergement';
import type { Hebergement } from '@/src/lib/hebergement';
import { Logo } from '@/app/components/Logo';
import { JustificatifHint } from '@/app/components/JustificatifHint';

export default function CentrePublicPage() {
  const { id } = useParams<{ id: string }>();
  const [centre, setCentre] = useState<Hebergement | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimState, setClaimState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [claimMsg, setClaimMsg] = useState<string>('');
  const [claimFile, setClaimFile] = useState<File | null>(null);
  const [isHebergeur, setIsHebergeur] = useState(false);

  // Bouton « Je gère ce centre » : redirige vers l'inscription si non connecté,
  // appelle le claim si hébergeur, sinon invite à se connecter en hébergeur.
  const handleClaim = async () => {
    if (!centre) return;
    const token = Cookies.get('token');
    if (!token) {
      window.location.href =
        `/register/hebergeur?claimCatalogueId=${encodeURIComponent(centre.id)}` +
        `&claimCentreNom=${encodeURIComponent(centre.nom)}`;
      return;
    }
    let role: string | null = null;
    try { role = JSON.parse(localStorage.getItem('sj_user_v2') ?? 'null')?.role ?? null; } catch {}
    if (role !== 'HEBERGEUR') {
      setClaimState('error');
      setClaimMsg('Connectez-vous avec un compte hébergeur pour revendiquer ce centre.');
      return;
    }
    setClaimState('loading');
    try {
      if (claimFile) {
        const fd = new FormData();
        fd.append('catalogueId', centre.id);
        fd.append('document', claimFile);
        await api.post('/centres/claim-from-catalogue', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/centres/claim-from-catalogue', { catalogueId: centre.id });
      }
      setClaimState('success');
      // Chaque centre est validé individuellement par l'équipe (plus d'auto-activate).
      setClaimMsg('Votre demande a été transmise. Le centre sera activé après validation par notre équipe.');
    } catch (e: unknown) {
      setClaimState('error');
      setClaimMsg((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Une erreur est survenue. Réessayez.');
    }
  };

  useEffect(() => {
    try {
      const token = Cookies.get('token');
      const role = JSON.parse(localStorage.getItem('sj_user_v2') ?? 'null')?.role ?? null;
      setIsHebergeur(!!token && role === 'HEBERGEUR');
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!id) return;
    getHebergementPublic(id)
      .then(setCentre)
      .catch(() => setCentre(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--color-primary)] border-t-transparent" />
    </div>
  );

  if (!centre) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-gray-500 mb-4">Centre introuvable.</p>
        <Link href="/catalogue" className="text-[var(--color-primary)] hover:underline">
          ← Retour au catalogue
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/"><Logo size="sm" showTagline={false} /></Link>
            <div className="flex items-center gap-4">
              <Link href="/catalogue" className="text-sm text-gray-500 hover:text-gray-900">
                ← Catalogue
              </Link>
              <Link href="/login" className="text-sm text-gray-500 hover:text-gray-900">
                Se connecter
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Image */}
        {centre.image && (
          <div className="rounded-2xl overflow-hidden mb-8 h-56 w-full">
            <img src={centre.image} alt={centre.nom} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Colonne principale */}
          <div className="lg:col-span-2">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{centre.nom}</h1>
            <p className="text-gray-500 mb-6">
              {centre.ville}{centre.departement ? ` — ${centre.departement}` : ''}
              {centre.codePostal ? ` (${centre.codePostal})` : ''}
            </p>

            {centre.description && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Description</h2>
                <p className="text-sm text-gray-600 leading-relaxed">{centre.description}</p>
              </div>
            )}

            {/* Thématiques */}
            {(centre.thematiques?.length > 0) && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Thématiques</h2>
                <div className="flex flex-wrap gap-2">
                  {centre.thematiques.map((t) => (
                    <span key={t} className="rounded-full bg-[var(--color-primary-light)] text-[var(--color-primary)] px-3 py-1 text-xs font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Activités */}
            {(centre.activites?.length > 0) && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Activités</h2>
                <div className="flex flex-wrap gap-2">
                  {centre.activites.map((a) => (
                    <span key={a} className="rounded-full bg-gray-100 text-gray-600 px-3 py-1 text-xs">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {centre.periodeOuverture && (
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">Période d&apos;ouverture :</span>{' '}
                {centre.periodeOuverture}
              </p>
            )}
          </div>

          {/* Colonne CTA */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sticky top-6">
              {centre.capaciteEleves != null && (
                <p className="text-sm text-gray-500 mb-1">
                  <span className="font-semibold text-gray-900 text-lg">{centre.capaciteEleves}</span> lits élèves
                </p>
              )}
              {centre.capaciteAdultes != null && (
                <p className="text-sm text-gray-500 mb-1">
                  <span className="font-semibold text-gray-900 text-lg">{centre.capaciteAdultes}</span> lits adultes
                </p>
              )}
              {centre.accessible && (
                <span className="inline-flex items-center rounded-full bg-[var(--color-success-light)] text-[var(--color-success)] px-2 py-0.5 text-xs font-medium mb-4">
                  Accessible PMR
                </span>
              )}

              <Link
                href={`/appel-offres?centreId=${centre.id}&centreNom=${encodeURIComponent(centre.nom)}`}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 transition-opacity mb-3"
              >
                Envoyer une demande à ce centre
              </Link>

              <Link
                href="/appel-offres"
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Lancer un appel d&apos;offres
              </Link>

              {centre.permalien && (
                <a href={centre.permalien} target="_blank" rel="noopener noreferrer"
                  className="mt-3 block text-center text-xs text-gray-400 hover:text-gray-600 hover:underline">
                  Voir le site du centre →
                </a>
              )}

              {/* ── Revendication hébergeur ── */}
              <div className="mt-6 pt-5 border-t border-gray-200">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center mb-3">
                  Vous gérez ce centre ?
                </p>
                {claimState === 'success' ? (
                  <p className="rounded-lg bg-[var(--color-success-light)] border border-[var(--color-success)]/20 px-3 py-2.5 text-xs text-[var(--color-success)] text-center">
                    {claimMsg}
                  </p>
                ) : (
                  <>
                    {isHebergeur && (
                      <div className="mb-3 space-y-2">
                        <JustificatifHint />
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          onChange={(e) => setClaimFile(e.target.files?.[0] ?? null)}
                          className="block w-full text-xs text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-primary)] file:text-white file:px-3 file:py-1.5 file:text-xs file:cursor-pointer hover:file:opacity-90"
                        />
                        <p className="text-[11px] text-gray-400">Justificatif optionnel — accélère la validation.</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleClaim}
                      disabled={claimState === 'loading'}
                      className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--color-primary)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors disabled:opacity-60"
                    >
                      {claimState === 'loading' ? 'Envoi…' : '🏠 Je gère ce centre'}
                    </button>
                    {claimState === 'error' && (
                      <p className="mt-2 text-xs text-red-600 text-center">{claimMsg}</p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
