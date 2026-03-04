'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createSejour } from '@/src/lib/sejour';
import type { TypeZone } from '@/src/lib/sejour';
import { extractApiError } from '@/src/contexts/AuthContext';
import { NIVEAUX, THEMATIQUES, REGIONS, DEPARTEMENTS } from '@/src/data/thematiques-pedagogiques';
import type { Niveau } from '@/src/data/thematiques-pedagogiques';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SejourFormData {
  titre: string;
  dateDebut: string;
  dateFin: string;
  nbEleves: string;
  niveauClasse: string;
  thematiquesPedagogiques: string[];
  informationsComplementaires: string;
  typeZone: TypeZone | '';
  zoneGeographique: string;
  dateButoireDevis: string;
}

const INITIAL_DATA: SejourFormData = {
  titre: '',
  dateDebut: '',
  dateFin: '',
  nbEleves: '',
  niveauClasse: '',
  thematiquesPedagogiques: [],
  informationsComplementaires: '',
  typeZone: '',
  zoneGeographique: '',
  dateButoireDevis: '',
};

const ZONE_OPTIONS: { value: TypeZone; emoji: string; label: string }[] = [
  { value: 'FRANCE',      emoji: '\uD83C\uDDEB\uD83C\uDDF7', label: 'France entière' },
  { value: 'REGION',      emoji: '\uD83D\uDCCD', label: 'Région' },
  { value: 'DEPARTEMENT', emoji: '\uD83C\uDFD9\uFE0F', label: 'Département' },
  { value: 'VILLE',       emoji: '\uD83C\uDFD8\uFE0F', label: 'Ville' },
];

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

// ─── Field wrapper ─────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

// ─── Page ──────────────────────────────────────────────────────────────────

export default function NouveauSejourPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<SejourFormData>(INITIAL_DATA);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [zoneFilter, setZoneFilter] = useState('');
  const [villeResults, setVilleResults] = useState<string[]>([]);
  const [villeLoading, setVilleLoading] = useState(false);

  const set = (field: keyof SejourFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  // Thématiques pour le niveau sélectionné
  const thematiquesDisponibles = useMemo(() => {
    if (!form.niveauClasse) return [];
    return THEMATIQUES[form.niveauClasse as Niveau] ?? [];
  }, [form.niveauClasse]);

  // Filtrage local régions/départements
  const filteredItems = useMemo(() => {
    const list = form.typeZone === 'REGION' ? [...REGIONS] : form.typeZone === 'DEPARTEMENT' ? [...DEPARTEMENTS] : [];
    if (!zoneFilter) return list;
    return list.filter((item) => item.toLowerCase().includes(zoneFilter.toLowerCase()));
  }, [form.typeZone, zoneFilter]);

  // Recherche ville via geo.api.gouv.fr
  const searchVilles = useCallback(async (q: string) => {
    if (q.length < 2) { setVilleResults([]); return; }
    setVilleLoading(true);
    try {
      const res = await fetch(`https://geo.api.gouv.fr/communes?nom=${encodeURIComponent(q)}&fields=nom,departement&boost=population&limit=8`);
      const data = await res.json() as Array<{ nom: string; departement?: { code: string; nom: string } }>;
      setVilleResults(data.map((c) => c.departement ? `${c.nom} (${c.departement.code})` : c.nom));
    } catch {
      setVilleResults([]);
    }
    setVilleLoading(false);
  }, []);

  // Debounce ville search
  useEffect(() => {
    if (form.typeZone !== 'VILLE' || !zoneFilter || form.zoneGeographique) return;
    const timer = setTimeout(() => searchVilles(zoneFilter), 300);
    return () => clearTimeout(timer);
  }, [zoneFilter, form.typeZone, form.zoneGeographique, searchVilles]);

  const toggleThematique = (t: string) => {
    setForm((prev) => ({
      ...prev,
      thematiquesPedagogiques: prev.thematiquesPedagogiques.includes(t)
        ? prev.thematiquesPedagogiques.filter((x) => x !== t)
        : [...prev.thematiquesPedagogiques, t],
    }));
  };

  const selectZoneType = (type: TypeZone) => {
    setForm((prev) => ({
      ...prev,
      typeZone: type,
      zoneGeographique: type === 'FRANCE' ? 'France' : '',
    }));
    setZoneFilter('');
    setVilleResults([]);
  };

  const selectZoneValue = (value: string) => {
    setForm((prev) => ({ ...prev, zoneGeographique: value }));
    setZoneFilter('');
    setVilleResults([]);
  };

  const zoneComplete = form.typeZone !== '' && form.zoneGeographique !== '';

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
    if (step === 2) return zoneComplete && form.dateButoireDevis;
    return true;
  };

  const zoneLabel = () => {
    if (!form.typeZone) return '';
    const opt = ZONE_OPTIONS.find((o) => o.value === form.typeZone);
    if (form.typeZone === 'FRANCE') return `${opt?.emoji} France entière`;
    return `${opt?.emoji} ${opt?.label} : ${form.zoneGeographique}`;
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

          {/* ── Étape 1 : Informations + thématiques ─────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Informations générales</h2>

              <Field label="Titre du séjour *">
                <input type="text" value={form.titre} onChange={set('titre')} placeholder="Ex : Séjour découverte des Alpes" className={inputCls} required />
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Date de début *">
                  <input type="date" value={form.dateDebut} onChange={set('dateDebut')} className={inputCls} required />
                </Field>
                <Field label="Date de fin *">
                  <input type="date" value={form.dateFin} min={form.dateDebut} onChange={set('dateFin')} className={inputCls} required />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Nombre d'élèves *">
                  <input type="number" value={form.nbEleves} onChange={set('nbEleves')} min={1} placeholder="Ex : 25" className={inputCls} required />
                </Field>
                <Field label="Niveau de classe *">
                  <select
                    value={form.niveauClasse}
                    onChange={(e) => setForm((prev) => ({ ...prev, niveauClasse: e.target.value, thematiquesPedagogiques: [] }))}
                    className={inputCls}
                  >
                    <option value="">Sélectionnez un niveau</option>
                    {NIVEAUX.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {form.niveauClasse && thematiquesDisponibles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Thématiques pédagogiques * <span className="text-xs font-normal text-gray-400">(min. 1)</span>
                  </label>
                  <div className="space-y-2">
                    {thematiquesDisponibles.map((t) => (
                      <label key={t} className="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={form.thematiquesPedagogiques.includes(t)}
                          onChange={() => toggleThematique(t)}
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700">{t}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Field label="Informations complémentaires (optionnel)">
                <textarea value={form.informationsComplementaires} onChange={set('informationsComplementaires')} rows={3} placeholder="Précisez ici tout élément spécifique à votre projet : contraintes particulières, besoins spéciaux, contexte de classe..." className={`${inputCls} resize-none`} />
              </Field>
            </div>
          )}

          {/* ── Étape 2 : Appel d'offres ──────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Appel d&apos;offres hébergement</h2>

              {/* Zone géographique */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Zone géographique souhaitée *</label>

                {/* Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {ZONE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectZoneType(opt.value)}
                      className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                        form.typeZone === opt.value
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Autocomplete: Région */}
                {form.typeZone === 'REGION' && (
                  <div className="relative">
                    <input
                      type="text"
                      value={form.zoneGeographique || zoneFilter}
                      onChange={(e) => {
                        setZoneFilter(e.target.value);
                        if (form.zoneGeographique) setForm((prev) => ({ ...prev, zoneGeographique: '' }));
                      }}
                      placeholder="Tapez pour rechercher une région…"
                      className={inputCls}
                    />
                    {zoneFilter && !form.zoneGeographique && filteredItems.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredItems.map((r) => (
                          <button key={r} type="button" onClick={() => selectZoneValue(r)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">
                            {r}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Autocomplete: Département */}
                {form.typeZone === 'DEPARTEMENT' && (
                  <div className="relative">
                    <input
                      type="text"
                      value={form.zoneGeographique || zoneFilter}
                      onChange={(e) => {
                        setZoneFilter(e.target.value);
                        if (form.zoneGeographique) setForm((prev) => ({ ...prev, zoneGeographique: '' }));
                      }}
                      placeholder="Tapez pour rechercher un département…"
                      className={inputCls}
                    />
                    {zoneFilter && !form.zoneGeographique && filteredItems.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {filteredItems.map((d) => (
                          <button key={d} type="button" onClick={() => selectZoneValue(d)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">
                            {d}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Autocomplete: Ville via geo.api.gouv.fr */}
                {form.typeZone === 'VILLE' && (
                  <div className="relative">
                    <input
                      type="text"
                      value={form.zoneGeographique || zoneFilter}
                      onChange={(e) => {
                        setZoneFilter(e.target.value);
                        if (form.zoneGeographique) setForm((prev) => ({ ...prev, zoneGeographique: '' }));
                      }}
                      placeholder="Tapez le nom d'une ville…"
                      className={inputCls}
                    />
                    {villeLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <span className="h-4 w-4 block animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                      </div>
                    )}
                    {zoneFilter && !form.zoneGeographique && villeResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {villeResults.map((v) => (
                          <button key={v} type="button" onClick={() => selectZoneValue(v)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700">
                            {v}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Sélection confirmée */}
                {form.zoneGeographique && (
                  <div className="mt-3 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
                      {zoneLabel()}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, zoneGeographique: '', typeZone: '' }));
                        setZoneFilter('');
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Modifier
                    </button>
                  </div>
                )}
              </div>

              <Field label="Date butoire de réponse des hébergements *">
                <input type="date" value={form.dateButoireDevis} onChange={set('dateButoireDevis')} min={new Date().toISOString().split('T')[0]} className={inputCls} required />
              </Field>

              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-sm text-blue-700">
                  Tous les hébergements de la zone sélectionnée recevront votre demande et pourront y répondre avant cette date.
                </p>
              </div>

              <div className="pt-2">
                <Link
                  href="/dashboard/teacher/hebergements"
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Parcourir le catalogue
                </Link>
              </div>
            </div>
          )}

          {/* ── Étape 3 : Récapitulatif ───────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Récapitulatif</h2>

              <div className="rounded-xl bg-gray-50 border border-gray-200 divide-y divide-gray-200 overflow-hidden text-sm">
                <Section title="Informations générales">
                  <Row label="Titre" value={form.titre} />
                  <Row label="Date de début" value={formatDate(form.dateDebut)} />
                  <Row label="Date de fin" value={formatDate(form.dateFin)} />
                  <Row label="Nombre d'élèves" value={form.nbEleves} />
                  <Row label="Niveau de classe" value={form.niveauClasse} />
                </Section>
                <Section title="Thématiques pédagogiques">
                  <div className="px-4 py-3 flex flex-wrap gap-2">
                    {form.thematiquesPedagogiques.map((t) => (
                      <span key={t} className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">
                        {t}
                      </span>
                    ))}
                  </div>
                </Section>
                <Section title="Appel d'offres">
                  <Row label="Zone géographique" value={zoneLabel()} />
                  <Row label="Date butoire" value={formatDate(form.dateButoireDevis)} />
                </Section>
                {form.informationsComplementaires && (
                  <Section title="Informations complémentaires">
                    <div className="px-4 py-3 text-sm text-gray-700 whitespace-pre-line">{form.informationsComplementaires}</div>
                  </Section>
                )}
              </div>
            </div>
          )}

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
