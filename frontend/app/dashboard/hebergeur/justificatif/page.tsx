'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth, extractApiError } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';
import { JustificatifHint } from '@/app/components/JustificatifHint';
import {
  centreCouvertParClaim,
  getMonClaimStatut,
  getMesCentresPending,
  uploadKbisOrganisation,
  uploadJustificatifCentre,
  validerFichierJustificatif,
  type CentrePending,
} from '@/src/lib/justificatif';

// Réponse GET /centres/onboarding-status (champs utilisés ici uniquement).
interface OnboardingStatus {
  etapes: {
    conformite: { justificatif: 'ABSENT' | 'EN_ATTENTE_VALIDATION' | 'VALIDE'; iban: boolean; ok: boolean };
  };
  organisationId: string | null;
}

// Détermination du cas — ordre strict (cf. chantier claim flow) :
//   a) justificatif ABSENT + claim EN_ATTENTE_DOCUMENT → (A) upload-kbis (champ "file")
//   b) centre PENDING sans claimDocumentUrl            → (B) upload-justificatif (champ "document")
//   c) sinon → état explicite, jamais de formulaire mort.
type Cas =
  | { type: 'chargement' }
  | { type: 'kbis'; organisationId: string; organisationNom: string | null }
  | { type: 'centre'; centres: CentrePending[] }
  | { type: 'examen' }
  | { type: 'rien' }
  | { type: 'erreur' };

const cardCls = 'bg-white rounded-2xl shadow-sm border border-gray-200 p-6';

export default function JustificatifPage() {
  const { user, isLoading, centreActif } = useAuth();

  const [cas, setCas] = useState<Cas>({ type: 'chargement' });
  const [centreChoisi, setCentreChoisi] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const determinerCas = useCallback(async () => {
    setCas({ type: 'chargement' });
    setError(null);
    const [onboarding, claim, pending] = await Promise.all([
      api.get<OnboardingStatus>('/centres/onboarding-status').then((r) => r.data).catch(() => null),
      getMonClaimStatut().catch(() => null),
      getMesCentresPending().catch(() => [] as CentrePending[]),
    ]);

    if (!onboarding && !claim && pending.length === 0) {
      setCas({ type: 'erreur' });
      return;
    }

    // Exclut les centres couverts par un claim EN_ATTENTE_VALIDATION de leur
    // organisation : leur redemander un justificatif recréerait la boucle de
    // redépôt. Liste vide → on tombe naturellement sur le cas "examen".
    const sansDocument = pending.filter(
      (c) => !c.claimDocumentUrl && !centreCouvertParClaim(c, claim),
    );

    // a) Premier claim (ex-nihilo) : cible l'organisation du CENTRE ACTIF
    //    (onboarding-status) ; mon-claim-statut seulement en fallback.
    if (
      onboarding?.etapes.conformite.justificatif === 'ABSENT' &&
      claim?.claimStatut === 'EN_ATTENTE_DOCUMENT'
    ) {
      const organisationId = onboarding.organisationId ?? claim.organisationId ?? null;
      if (organisationId) {
        setCas({ type: 'kbis', organisationId, organisationNom: claim.organisationNom ?? null });
        return;
      }
    }

    // b) Centre(s) PENDING sans justificatif — couvre aussi le centre sans organisation.
    if (sansDocument.length > 0) {
      setCas({ type: 'centre', centres: sansDocument });
      // Cascade multi-centre : préselectionner le centre actif s'il est dans la
      // liste ; sinon l'utilisateur choisit explicitement (jamais au hasard).
      setCentreChoisi(
        sansDocument.length === 1
          ? sansDocument[0].id
          : sansDocument.some((c) => c.id === centreActif) ? centreActif : null,
      );
      return;
    }

    // c) Rien à déposer : distinguer "déjà transmis" de "rien d'attendu".
    if (
      claim?.claimStatut === 'EN_ATTENTE_VALIDATION' ||
      onboarding?.etapes.conformite.justificatif === 'EN_ATTENTE_VALIDATION' ||
      pending.some((c) => c.claimDocumentUrl)
    ) {
      setCas({ type: 'examen' });
      return;
    }
    setCas({ type: 'rien' });
  }, [centreActif]);

  useEffect(() => {
    if (user?.role === 'HEBERGEUR') determinerCas();
  }, [user, determinerCas]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) { setFile(null); return; }
    const invalide = validerFichierJustificatif(f);
    if (invalide) {
      setError(invalide);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setError(null);
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      if (cas.type === 'kbis') {
        // (A) — champ multipart "file"
        await uploadKbisOrganisation(cas.organisationId, file);
      } else if (cas.type === 'centre' && centreChoisi) {
        // (B) — champ multipart "document"
        await uploadJustificatifCentre(centreChoisi, file);
      } else {
        return;
      }
      // ⚠️ Point critique du chantier : refetch de l'état APRÈS upload. Sans lui,
      // la checklist resterait rouge et l'hébergeur redéposerait en boucle.
      setSuccess(true);
      await determinerCas();
    } catch (err: unknown) {
      const msg = extractApiError(err);
      // Course : l'admin a traité le claim entre l'affichage et l'envoi.
      if (msg.includes("n'attend pas de document")) {
        setError('Votre justificatif a déjà été traité — il n\'y a plus rien à déposer.');
        await determinerCas();
      } else {
        setError(msg);
      }
    } finally {
      setUploading(false);
    }
  };

  if (isLoading || !user) return null;
  // Non-hébergeur : le layout hébergeur redirige vers /login — ne pas laisser
  // le skeleton s'afficher en attendant la redirection.
  if (user.role !== 'HEBERGEUR') return null;

  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Justificatif de votre structure</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ce document permet à l&apos;équipe LIAVO de vérifier que vous êtes bien le gestionnaire
          de votre centre, puis de l&apos;activer au catalogue.
        </p>
      </div>

      {/* Succès : état explicite, jamais de retour silencieux. */}
      {success && (
        <div className="mb-6 rounded-2xl border border-green-200 bg-[var(--color-success-light)] p-6">
          <p className="text-sm font-semibold text-[var(--color-success)]">
            Justificatif transmis — en cours d&apos;examen par l&apos;équipe LIAVO.
          </p>
          <p className="mt-1 text-sm text-[var(--color-success)] opacity-80">
            Vous recevrez un email dès qu&apos;il sera traité. Aucun nouveau dépôt n&apos;est nécessaire.
          </p>
          <Link
            href="/dashboard/hebergeur"
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
          >
            Retour au tableau de bord →
          </Link>
        </div>
      )}

      {error && (
        <div role="alert" className="mb-5 flex items-start gap-3 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {cas.type === 'chargement' && !success && (
        <div className={`${cardCls} animate-pulse`}>
          <div className="h-4 w-56 rounded bg-gray-200 mb-3" />
          <div className="h-3 w-full rounded bg-gray-100 mb-2" />
          <div className="h-3 w-2/3 rounded bg-gray-100" />
        </div>
      )}

      {cas.type === 'erreur' && (
        <div className={cardCls}>
          <p className="text-sm text-gray-600">
            Impossible de charger votre situation. Vérifiez votre connexion puis réessayez.
          </p>
          <button
            type="button"
            onClick={determinerCas}
            className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Cas (c) — état explicite, jamais un formulaire mort. */}
      {cas.type === 'examen' && !success && (
        <div className={cardCls}>
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <svg className="h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            Justificatif déjà transmis, en cours d&apos;examen.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Notre équipe le vérifie — vous recevrez un email dès qu&apos;il sera traité.
            Il n&apos;y a rien d&apos;autre à faire de votre côté.
          </p>
          <Link href="/dashboard/hebergeur" className="mt-4 inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline">
            Retour au tableau de bord →
          </Link>
        </div>
      )}

      {cas.type === 'rien' && !success && (
        <div className={cardCls}>
          <p className="text-sm font-semibold text-gray-800">Aucun justificatif attendu.</p>
          <p className="mt-2 text-sm text-gray-500">
            Votre situation ne nécessite pas de dépôt de justificatif pour le moment.
          </p>
          <Link href="/dashboard/hebergeur" className="mt-4 inline-block text-sm font-semibold text-[var(--color-primary)] hover:underline">
            Retour au tableau de bord →
          </Link>
        </div>
      )}

      {/* Cas (a) et (b) — formulaire de dépôt. */}
      {(cas.type === 'kbis' || cas.type === 'centre') && !success && (
        <div className={cardCls}>
          {cas.type === 'kbis' && (
            <p className="mb-4 text-sm text-gray-600">
              Justificatif attendu pour valider la propriété de votre structure
              {cas.organisationNom ? <> <strong>{cas.organisationNom}</strong></> : null}.
            </p>
          )}

          {cas.type === 'centre' && cas.centres.length === 1 && (
            <p className="mb-4 text-sm text-gray-600">
              Justificatif attendu pour l&apos;activation du centre <strong>{cas.centres[0].nom}</strong>.
            </p>
          )}

          {/* Cascade multi-centre : plusieurs centres PENDING → choix explicite. */}
          {cas.type === 'centre' && cas.centres.length > 1 && (
            <fieldset className="mb-4">
              <legend className="text-sm font-medium text-gray-800 mb-2">
                Plusieurs centres attendent un justificatif — choisissez :
              </legend>
              <div className="space-y-2">
                {cas.centres.map((c) => (
                  <label key={c.id} className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-sm cursor-pointer transition ${centreChoisi === c.id ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input
                      type="radio"
                      name="centre"
                      checked={centreChoisi === c.id}
                      onChange={() => setCentreChoisi(c.id)}
                      className="accent-[var(--color-primary)]"
                    />
                    <span className="font-medium text-gray-800">{c.nom}</span>
                    {c.id === centreActif && (
                      <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">centre actif</span>
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <JustificatifHint className="mb-4" />

          <label htmlFor="justificatif" className="block text-sm font-medium text-gray-700 mb-1.5">
            Document <span className="text-gray-400 font-normal">(PDF, JPG ou PNG — 10 Mo max)</span>
          </label>
          <input
            id="justificatif"
            ref={fileRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--color-primary-light)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--color-primary)] hover:file:opacity-90"
          />

          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || !file || (cas.type === 'centre' && !centreChoisi)}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Envoi en cours…
              </>
            ) : (
              'Envoyer le justificatif'
            )}
          </button>
        </div>
      )}
    </main>
  );
}
