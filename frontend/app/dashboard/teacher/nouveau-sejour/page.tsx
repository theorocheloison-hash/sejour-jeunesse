'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSejour } from '@/src/lib/sejour';
import type { TypeZone } from '@/src/lib/sejour';
import { extractApiError } from '@/src/contexts/AuthContext';
import { INITIAL_DATA } from '@/src/components/sejour/shared';
import EtapeInfos from '@/src/components/sejour/EtapeInfos';
import EtapeGeographie from '@/src/components/sejour/EtapeGeographie';
import EtapeRecapitulatif from '@/src/components/sejour/EtapeRecapitulatif';

// ─── Step Indicator ────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ['Informations', 'Appel d\'offres', 'Récapitulatif'];
  return (
    <div className="flex items-center gap-0 mb-8">
      {labels.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  done
                    ? 'bg-indigo-600 text-white'
                    : active
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-100'
                    : 'bg-gray-100 text-gray-400'
                }`}
              >
                {done ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step
                )}
              </div>
              <span
                className={`mt-1.5 text-xs font-medium whitespace-nowrap ${
                  active ? 'text-indigo-600' : done ? 'text-gray-500' : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            </div>
            {step < total && (
              <div
                className={`flex-1 h-0.5 mx-2 mb-5 transition-colors ${
                  done ? 'bg-indigo-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function NouveauSejourPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(INITIAL_DATA);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const canAdvance = () => {
    if (step === 1)
      return (
        form.titre &&
        form.dateDebut &&
        form.dateFin &&
        form.nbEleves &&
        form.niveauClasse &&
        form.thematiquesPedagogiques.length > 0
      );
    if (step === 2) return form.typeZone && form.zoneGeographique && form.dateButoireDevis;
    return true;
  };

  const handleSubmit = async () => {
    setError(null);
    setIsPending(true);
    try {
      await createSejour({
        titre:                      form.titre,
        informationsComplementaires: form.informationsComplementaires || undefined,
        dateDebut:                  form.dateDebut,
        dateFin:                    form.dateFin,
        nombreEleves:               parseInt(form.nbEleves, 10),
        niveauClasse:               form.niveauClasse,
        thematiquesPedagogiques:    form.thematiquesPedagogiques,
        typeZone:                   form.typeZone as TypeZone,
        zoneGeographique:           form.zoneGeographique,
        dateButoireDevis:           form.dateButoireDevis,
      });
      router.push('/dashboard/teacher');
    } catch (err) {
      setError(extractApiError(err));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
                <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <span className="font-semibold text-gray-900">Séjour Jeunesse</span>
            </div>
            <Link href="/dashboard/teacher" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
              &larr; Retour
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Nouveau séjour</h1>
          <p className="mt-1 text-sm text-gray-500">Renseignez les informations en 3 étapes</p>
        </div>

        <StepIndicator current={step} total={3} />

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">

          {error && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {step === 1 && <EtapeInfos form={form} setForm={setForm} />}
          {step === 2 && <EtapeGeographie form={form} setForm={setForm} />}
          {step === 3 && <EtapeRecapitulatif form={form} />}

          {/* ── Navigation ──────────────────────────────────────── */}
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              &larr; Précédent
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Suivant &rarr;
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                {isPending ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Envoi en cours…
                  </>
                ) : (
                  'Créer le séjour'
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
