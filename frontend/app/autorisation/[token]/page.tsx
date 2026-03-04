'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  getAutorisationPublique,
  signerAutorisation,
  type AutorisationPublique,
} from '@/src/lib/autorisation';

export default function SignerAutorisationPage() {
  const { token } = useParams<{ token: string }>();

  const [autorisation, setAutorisation] = useState<AutorisationPublique | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [infosMedicales, setInfosMedicales] = useState('');
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    if (!token) return;
    getAutorisationPublique(token)
      .then((data) => {
        setAutorisation(data);
        if (data.signeeAt) setSigned(true);
      })
      .catch(() => setError('Lien invalide ou autorisation introuvable.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async () => {
    if (!token) return;
    setSigning(true);
    try {
      await signerAutorisation(token, {
        infosMedicales: infosMedicales.trim() || undefined,
      });
      setSigned(true);
    } catch {
      setError('Erreur lors de la signature. Veuillez réessayer.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (error && !autorisation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
            <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="mt-4 text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  if (!autorisation) return null;

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center px-4 py-12">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
        {/* En-tête */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Autorisation parentale</h1>
        </div>

        {/* Infos séjour */}
        <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-5 mb-6">
          <h2 className="text-lg font-semibold text-indigo-900 mb-3">
            {autorisation.sejour.titre}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-indigo-700">
            <div>
              <span className="font-medium">Lieu :</span> {autorisation.sejour.lieu}
            </div>
            <div>
              <span className="font-medium">Du</span> {fmt(autorisation.sejour.dateDebut)}{' '}
              <span className="font-medium">au</span> {fmt(autorisation.sejour.dateFin)}
            </div>
          </div>
        </div>

        {/* Infos élève */}
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-5 mb-6">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">Élève concerné(e) :</span>{' '}
            {autorisation.elevePrenom} {autorisation.eleveNom}
          </p>
        </div>

        {signed ? (
          /* Message confirmation */
          <div className="rounded-xl bg-green-50 border border-green-200 p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-semibold text-green-800">
              {autorisation.signeeAt
                ? 'Cette autorisation a déjà été signée.'
                : 'Autorisation signée avec succès !'}
            </p>
            <p className="mt-1 text-xs text-green-600">
              Merci pour votre confiance.
            </p>
          </div>
        ) : (
          /* Formulaire de signature */
          <>
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="mb-6">
              <label
                htmlFor="infosMedicales"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Informations médicales importantes{' '}
                <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <textarea
                id="infosMedicales"
                rows={3}
                value={infosMedicales}
                onChange={(e) => setInfosMedicales(e.target.value)}
                placeholder="Allergies, traitements en cours, régime alimentaire..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleSign}
              disabled={signing}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              {signing ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Signature en cours…
                </span>
              ) : (
                'Je signe et autorise mon enfant à participer'
              )}
            </button>

            <p className="mt-3 text-xs text-gray-400 text-center">
              En signant, vous autorisez la participation de votre enfant à ce séjour.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
