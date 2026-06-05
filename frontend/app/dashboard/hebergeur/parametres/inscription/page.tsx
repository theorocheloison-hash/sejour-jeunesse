'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import api from '@/src/lib/api';

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

// Libellés des champs standard (clé technique → libellé affiché)
const CHAMPS_STANDARD_LABELS: Record<string, string> = {
  taille: 'Taille (cm)',
  poids: 'Poids (kg)',
  pointure: 'Pointure',
  niveauSki: 'Niveau de ski',
  regimeAlimentaire: 'Régime alimentaire',
  eleveDateNaissance: 'Date de naissance',
  nomParent: 'Nom du parent / responsable',
  telephoneUrgence: "Téléphone d'urgence",
  infosMedicales: 'Informations médicales',
};

const STANDARD_KEYS = Object.keys(CHAMPS_STANDARD_LABELS);
const MAX_CUSTOM = 5;

type ChampType = 'text' | 'number' | 'select';

// Ligne de formulaire pour un champ personnalisé (options éditées en texte)
interface CustomRow {
  nom: string;
  type: ChampType;
  obligatoire: boolean;
  optionsText: string;
}

const TYPE_LABELS: { value: ChampType; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'number', label: 'Nombre' },
  { value: 'select', label: 'Liste' },
];

// Un nom custom ne peut pas matcher une clé technique ou un libellé standard
function isReservedName(nom: string): boolean {
  const n = nom.trim().toLowerCase();
  if (!n) return false;
  return (
    STANDARD_KEYS.some((k) => k.toLowerCase() === n) ||
    Object.values(CHAMPS_STANDARD_LABELS).some((l) => l.toLowerCase() === n)
  );
}

export default function ConfigInscriptionPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [champsActifs, setChampsActifs] = useState<string[]>([]);
  const [customRows, setCustomRows] = useState<CustomRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Garde-fou rôle (le layout redirige déjà, ceci est une double sécurité)
  useEffect(() => {
    if (!isLoading && user && user.role !== 'HEBERGEUR') {
      router.replace('/dashboard');
    }
  }, [isLoading, user, router]);

  // Chargement de la config au mount
  useEffect(() => {
    if (!user || user.role !== 'HEBERGEUR') return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{
          champsActifs: string[];
          champsCustom: Array<{
            nom: string;
            type: ChampType;
            obligatoire: boolean;
            options?: string[];
          }>;
        }>('/centres/config-inscription');
        if (cancelled) return;
        setChampsActifs(Array.isArray(data.champsActifs) ? data.champsActifs : []);
        setCustomRows(
          Array.isArray(data.champsCustom)
            ? data.champsCustom.map((c) => ({
                nom: c.nom,
                type: c.type,
                obligatoire: !!c.obligatoire,
                optionsText: (c.options ?? []).join('\n'),
              }))
            : [],
        );
      } catch {
        if (!cancelled) setLoadError('Impossible de charger la configuration. Réessayez.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function toggleStandard(key: string) {
    setSaveSuccess(false);
    setChampsActifs((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function addCustomRow() {
    if (customRows.length >= MAX_CUSTOM) return;
    setSaveSuccess(false);
    setCustomRows((prev) => [
      ...prev,
      { nom: '', type: 'text', obligatoire: false, optionsText: '' },
    ]);
  }

  function updateCustomRow(index: number, patch: Partial<CustomRow>) {
    setSaveSuccess(false);
    setCustomRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    );
  }

  function removeCustomRow(index: number) {
    setSaveSuccess(false);
    setCustomRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaveError(null);
    setSaveSuccess(false);

    // Construction + validation des champs personnalisés
    const seen = new Set<string>();
    const champsCustom: Array<{
      nom: string;
      type: ChampType;
      obligatoire: boolean;
      options?: string[];
    }> = [];

    for (const row of customRows) {
      const nom = row.nom.trim();
      if (!nom) {
        setSaveError('Chaque champ personnalisé doit avoir un nom.');
        return;
      }
      if (nom.length > 100) {
        setSaveError(`Le nom "${nom}" dépasse 100 caractères.`);
        return;
      }
      if (isReservedName(nom)) {
        setSaveError(`"${nom}" est réservé à un champ standard.`);
        return;
      }
      const key = nom.toLowerCase();
      if (seen.has(key)) {
        setSaveError(`Nom de champ personnalisé dupliqué : ${nom}`);
        return;
      }
      seen.add(key);

      const entry: {
        nom: string;
        type: ChampType;
        obligatoire: boolean;
        options?: string[];
      } = { nom, type: row.type, obligatoire: row.obligatoire };

      if (row.type === 'select') {
        const options = row.optionsText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);
        if (options.length === 0) {
          setSaveError(`Le champ "${nom}" (liste) doit avoir au moins une option.`);
          return;
        }
        entry.options = options;
      }

      champsCustom.push(entry);
    }

    setSaving(true);
    try {
      await api.patch('/centres/config-inscription', { champsActifs, champsCustom });
      setSaveSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setSaveError(msg || "Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !user) return null;

  const aucunChamp = champsActifs.length === 0 && customRows.length === 0;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--color-bg)]">
      <nav className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-base font-semibold text-gray-900">
          Fiche d&apos;inscription participants
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Configurez les informations que vous souhaitez collecter auprès des
          organisateurs pour chaque participant.
        </p>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6 w-full">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : loadError ? (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        ) : (
          <>
            {aucunChamp && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-700">
                Aucun champ configuré — le mode saisie directe ne sera pas proposé
                aux organisateurs.
              </div>
            )}

            {/* ── Champs standard ─────────────────────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-900 mb-1">
                Champs standard
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Cochez les informations à collecter pour chaque participant.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {STANDARD_KEYS.map((key) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={champsActifs.includes(key)}
                      onChange={() => toggleStandard(key)}
                      className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                    />
                    <span className="text-sm text-gray-700">
                      {CHAMPS_STANDARD_LABELS[key]}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            {/* ── Champs personnalisés ────────────────────────────────── */}
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-sm font-semibold text-gray-900">
                  Champs personnalisés
                </h2>
                <span className="text-xs text-gray-400">
                  {customRows.length}/{MAX_CUSTOM}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                Ajoutez vos propres champs (maximum {MAX_CUSTOM}).
              </p>

              {customRows.length === 0 ? (
                <p className="text-xs text-gray-400 mb-4">
                  Aucun champ personnalisé.
                </p>
              ) : (
                <div className="space-y-4 mb-4">
                  {customRows.map((row, i) => {
                    const reserved = isReservedName(row.nom);
                    return (
                      <div
                        key={i}
                        className="rounded-lg border border-gray-200 p-4 space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-500 mb-1">
                              Nom du champ
                            </label>
                            <input
                              value={row.nom}
                              onChange={(e) =>
                                updateCustomRow(i, { nom: e.target.value })
                              }
                              className={inputCls}
                              placeholder="Ex: Allergies, Numéro de licence…"
                              maxLength={100}
                            />
                            {reserved && (
                              <p className="mt-1 text-xs text-red-600">
                                Ce nom est réservé à un champ standard.
                              </p>
                            )}
                          </div>
                          <div className="w-32">
                            <label className="block text-xs text-gray-500 mb-1">
                              Type
                            </label>
                            <select
                              value={row.type}
                              onChange={(e) =>
                                updateCustomRow(i, {
                                  type: e.target.value as ChampType,
                                })
                              }
                              className={inputCls}
                            >
                              {TYPE_LABELS.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCustomRow(i)}
                            className="mt-6 text-gray-400 hover:text-red-500 shrink-0"
                            title="Supprimer ce champ"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>

                        {row.type === 'select' && (
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Options (une par ligne)
                            </label>
                            <textarea
                              value={row.optionsText}
                              onChange={(e) =>
                                updateCustomRow(i, { optionsText: e.target.value })
                              }
                              rows={3}
                              className={`${inputCls} resize-none`}
                              placeholder={'Option A\nOption B\nOption C'}
                            />
                          </div>
                        )}

                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={row.obligatoire}
                            onChange={(e) =>
                              updateCustomRow(i, { obligatoire: e.target.checked })
                            }
                            className="rounded border-gray-300 text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                          />
                          <span className="text-sm text-gray-700">
                            Champ obligatoire
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                type="button"
                onClick={addCustomRow}
                disabled={customRows.length >= MAX_CUSTOM}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4.5v15m7.5-7.5h-15"
                  />
                </svg>
                Ajouter un champ personnalisé
              </button>
            </section>

            {/* ── Feedback + Enregistrer ──────────────────────────────── */}
            {saveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            )}
            {saveSuccess && (
              <div className="rounded-lg bg-[var(--color-success-light)] border border-[var(--color-success)] px-4 py-3 text-sm text-[var(--color-success)] font-medium">
                Configuration enregistrée.
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {saving && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
