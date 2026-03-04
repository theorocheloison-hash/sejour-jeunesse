'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSejour } from '@/src/lib/sejour';
import { extractApiError } from '@/src/contexts/AuthContext';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SejourFormData {
  // Étape 1 — Informations générales
  titre: string;
  description: string;
  dateDebut: string;
  dateFin: string;
  nbEleves: string;
  // Étape 2 — Hébergement
  ville: string;
}

const INITIAL_DATA: SejourFormData = {
  titre: '',
  description: '',
  dateDebut: '',
  dateFin: '',
  nbEleves: '',
  ville: '',
};

// ─── Composant indicateur d'étapes ─────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = ['Informations', 'Hébergement', 'Récapitulatif'];
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

// ─── Composant champ de formulaire ─────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

// ─── Page principale ────────────────────────────────────────────────────────

export default function NouveauSejourPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<SejourFormData>(INITIAL_DATA);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const set = (field: keyof SejourFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // ── Validation par étape ──────────────────────────────────────────────────
  const canAdvance = () => {
    if (step === 1)
      return form.titre && form.dateDebut && form.dateFin && form.nbEleves;
    if (step === 2) return form.ville;
    return true;
  };

  // ── Soumission ─────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError(null);
    setIsPending(true);
    try {
      await createSejour({
        titre:             form.titre,
        description:       form.description || undefined,
        dateDebut:         form.dateDebut,
        dateFin:           form.dateFin,
        nombreEleves:      parseInt(form.nbEleves, 10),
        villeHebergement:  form.ville,
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

      {/* ── Header ─────────────────────────────────────────────────────────── */}
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
              ← Retour
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Contenu ────────────────────────────────────────────────────────── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Nouveau séjour</h1>
          <p className="mt-1 text-sm text-gray-500">Renseignez les informations en {3} étapes</p>
        </div>

        <StepIndicator current={step} total={3} />

        {/* ── Carte du formulaire ───────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 sm:p-8">

          {/* Erreur globale */}
          {error && (
            <div role="alert" className="mb-6 flex items-start gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* ── Étape 1 : Informations générales ─────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Informations générales</h2>

              <Field label="Titre du séjour *">
                <input
                  type="text"
                  value={form.titre}
                  onChange={set('titre')}
                  placeholder="Ex : Séjour découverte des Alpes"
                  className={inputCls}
                  required
                />
              </Field>

              <Field label="Description / objectifs pédagogiques">
                <textarea
                  value={form.description}
                  onChange={set('description')}
                  rows={4}
                  placeholder="Décrivez les objectifs pédagogiques de ce séjour…"
                  className={`${inputCls} resize-none`}
                />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Date de début *">
                  <input
                    type="date"
                    value={form.dateDebut}
                    onChange={set('dateDebut')}
                    className={inputCls}
                    required
                  />
                </Field>
                <Field label="Date de fin *">
                  <input
                    type="date"
                    value={form.dateFin}
                    min={form.dateDebut}
                    onChange={set('dateFin')}
                    className={inputCls}
                    required
                  />
                </Field>
              </div>

              <Field label="Nombre d'élèves *">
                <input
                  type="number"
                  value={form.nbEleves}
                  onChange={set('nbEleves')}
                  min={1}
                  placeholder="Ex : 25"
                  className={inputCls}
                  required
                />
              </Field>
            </div>
          )}

          {/* ── Étape 2 : Hébergement ────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Hébergement</h2>

              <Field label="Ville / lieu *">
                <input
                  type="text"
                  value={form.ville}
                  onChange={set('ville')}
                  placeholder="Ex : Chamonix"
                  className={inputCls}
                  required
                />
              </Field>

              <div className="rounded-xl bg-indigo-50 border border-indigo-100 p-4">
                <p className="text-sm text-indigo-700 mb-3">
                  Consultez notre catalogue pour trouver un hébergement adapté à votre séjour.
                </p>
                <Link
                  href="/dashboard/teacher/hebergements"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Rechercher un hébergement
                </Link>
              </div>
            </div>
          )}

          {/* ── Étape 3 : Récapitulatif ──────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Récapitulatif</h2>

              <div className="rounded-xl bg-gray-50 border border-gray-200 divide-y divide-gray-200 overflow-hidden text-sm">
                <Section title="Informations générales">
                  <Row label="Titre"        value={form.titre} />
                  <Row label="Description"  value={form.description || '—'} />
                  <Row label="Date de début" value={formatDate(form.dateDebut)} />
                  <Row label="Date de fin"   value={formatDate(form.dateFin)} />
                  <Row label="Nombre d'élèves" value={form.nbEleves} />
                </Section>
                <Section title="Hébergement">
                  <Row label="Ville" value={form.ville} />
                </Section>
              </div>
            </div>
          )}

          {/* ── Navigation ───────────────────────────────────────────────── */}
          <div className="mt-8 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 1}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Précédent
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canAdvance()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              >
                Suivant →
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
                  'Soumettre le séjour'
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Helpers d'affichage ────────────────────────────────────────────────────

function formatDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="bg-gray-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div className="divide-y divide-gray-200">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 text-right font-medium break-words max-w-xs">{value}</span>
    </div>
  );
}
