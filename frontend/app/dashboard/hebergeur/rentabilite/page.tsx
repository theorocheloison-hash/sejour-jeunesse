'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getTableauRentabilite,
  getMesFacturesPrestataires,
  createFacturePrestataire,
  updateFacturePrestataire,
  deleteFacturePrestataire,
  uploadFichierFacturePrestataire,
} from '@/src/lib/rentabilite';
import type {
  TableauRentabilite,
  FacturePrestataire,
  LigneRentabilite,
} from '@/src/lib/rentabilite';

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent';

// Suggestions pour le datalist (saisie libre acceptée)
const TYPES_CHARGE_SUGGESTIONS = [
  'VTT', 'Rafting', 'Via ferrata', 'Escalade', 'Canyoning',
  'Spéléologie', 'Accrobranche', 'Tir à l\'arc', 'Cours de ski',
  'Remontées mécaniques', 'Location matériel', 'Transport',
  'Course d\'orientation', 'Randonnée', 'Refuge',
];

// Mapping rétro-compatibilité : anciennes valeurs enum → libellé français
// Utilisé UNIQUEMENT pour l'affichage des factures existantes
const TYPE_CHARGE_LEGACY: Record<string, string> = {
  GUIDE_AMM: 'Guide / AMM',
  ESF: 'Cours de ski',
  TRANSPORT: 'Transport',
  ACTIVITE: 'Activité',
  LOCATION: 'Location matériel',
  RESTAURATION: 'Restauration',
  AUTRE: 'Autre',
};

// ── Formatage ────────────────────────────────────────────────────────────────
const fmtMontant = (n: number) =>
  n.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' €';

const fmtTaux = (t: number | null) =>
  t === null
    ? '—'
    : t.toLocaleString('fr-FR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }) + ' %';

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

// Couleur du taux de marge selon sa valeur
function tauxColor(t: number | null): string | undefined {
  if (t === null) return undefined;
  if (t >= 20) return '#16A34A';
  if (t >= 10) return '#EA580C';
  return '#DC2626';
}

// État d'une ligne de ventilation dans le formulaire (montant en string pour l'input)
interface VentilationRow {
  sejourId: string;
  montantTTC: string;
}

const emptyForm = {
  nomPrestataire: '',
  typeCharge: '', // ← vide, pas 'GUIDE_AMM'
  numeroFacture: '',
  dateFacture: '',
  montantTotalTTC: '',
  notes: '',
};

export default function HebergeurRentabilitePage() {
  const { user, isLoading } = useAuth();

  // Onglet actif
  const [tab, setTab] = useState<'tableau' | 'factures'>('tableau');

  // Données tableau (filtrées)
  const [tableau, setTableau] = useState<TableauRentabilite | null>(null);
  const [loading, setLoading] = useState(true);

  // Données factures
  const [factures, setFactures] = useState<FacturePrestataire[]>([]);

  // Séjours disponibles pour le formulaire — chargés SANS filtre de date
  // pour que le formulaire montre tous les séjours même si le filtre
  // de la page est restreint à un mois précis.
  const [sejoursDisponibles, setSejoursDisponibles] = useState<
    LigneRentabilite[]
  >([]);

  // Filtres
  const currentYear = new Date().getFullYear().toString();
  const [annee, setAnnee] = useState<string>(currentYear);
  const [mois, setMois] = useState<string>(''); // '' = toute l'année
  const [natureFilter, setNatureFilter] = useState<
    'TOUS' | 'SEJOUR' | 'EVENEMENT'
  >('SEJOUR');

  // Formulaire
  const [formOpen, setFormOpen] = useState(false);
  const [editingFacture, setEditingFacture] =
    useState<FacturePrestataire | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [ventilations, setVentilations] = useState<VentilationRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Chargement des données ──────────────────────────────────────────────
  // Charge le tableau filtré à chaque changement de filtre
  useEffect(() => {
    loadTableau();
  }, [annee, mois]);

  // Charge les factures et les séjours disponibles (sans filtre) UNE SEULE FOIS au mount
  useEffect(() => {
    loadFactures();
    loadSejoursDisponibles();
  }, []);

  async function loadTableau() {
    setLoading(true);
    try {
      const params = mois ? { mois: `${annee}-${mois}` } : { annee };
      const t = await getTableauRentabilite(params);
      setTableau(t);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  async function loadFactures() {
    try {
      const f = await getMesFacturesPrestataires();
      setFactures(f);
    } catch {
      /* ignore */
    }
  }

  async function loadSejoursDisponibles() {
    // Charge TOUS les séjours sans filtre de date pour la liste de sélection
    try {
      const t = await getTableauRentabilite();
      setSejoursDisponibles(t.sejours);
    } catch {
      /* ignore */
    }
  }

  async function reload() {
    await Promise.all([loadTableau(), loadFactures()]);
  }

  // ── Gestion du formulaire ───────────────────────────────────────────────
  function openCreate() {
    setEditingFacture(null);
    setForm(emptyForm);
    setVentilations([]);
    setFile(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(f: FacturePrestataire) {
    setEditingFacture(f);
    setForm({
      nomPrestataire: f.nomPrestataire,
      typeCharge: TYPE_CHARGE_LEGACY[f.typeCharge] ?? f.typeCharge,
      numeroFacture: f.numeroFacture ?? '',
      dateFacture: f.dateFacture ? f.dateFacture.split('T')[0] : '',
      montantTotalTTC: String(f.montantTotalTTC),
      notes: f.notes ?? '',
    });
    setVentilations(
      f.ventilations.map((v) => ({
        sejourId: v.sejourId,
        montantTTC: String(v.montantTTC),
      })),
    );
    setFile(null);
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFormOpen(false);
    setEditingFacture(null);
  }

  function addVentilation() {
    setVentilations((rows) => [...rows, { sejourId: '', montantTTC: '' }]);
  }

  function updateVentilation(
    index: number,
    field: keyof VentilationRow,
    value: string,
  ) {
    setVentilations((rows) =>
      rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  }

  function removeVentilation(index: number) {
    setVentilations((rows) => rows.filter((_, i) => i !== index));
  }

  const montantTotal = parseFloat(form.montantTotalTTC) || 0;
  const totalVentile = ventilations.reduce(
    (sum, v) => sum + (parseFloat(v.montantTTC) || 0),
    0,
  );
  const ventilationExcessive = totalVentile > montantTotal + 0.01;

  // ── Filtrage par nature + totaux recalculés CÔTÉ FRONTEND ────────────────
  // ⚠️ tableau.totaux vient du backend (TOUS les séjours). Toujours utiliser
  // totauxFiltres dans le rendu, jamais tableau.totaux.
  const sejoursFiltres: LigneRentabilite[] = (() => {
    if (!tableau) return [];
    if (natureFilter === 'TOUS') return tableau.sejours;
    return tableau.sejours.filter((s) => s.natureSejour === natureFilter);
  })();

  const totauxFiltres = (() => {
    const caTTC = sejoursFiltres.reduce((s, r) => s + r.caTTC, 0);
    const chargesTTC = sejoursFiltres.reduce((s, r) => s + r.chargesTTC, 0);
    const margeTTC = caTTC - chargesTTC;
    const tauxMarge =
      caTTC > 0 ? Math.round((margeTTC / caTTC) * 1000) / 10 : null;
    return { caTTC, chargesTTC, margeTTC, tauxMarge };
  })();

  async function handleSave() {
    setFormError(null);
    if (!form.nomPrestataire.trim()) {
      setFormError('Le nom du prestataire est obligatoire.');
      return;
    }
    if (montantTotal <= 0) {
      setFormError('Le montant total doit être supérieur à 0.');
      return;
    }
    // Ne conserver que les ventilations complètes (séjour + montant)
    const ventilationsValides = ventilations
      .filter((v) => v.sejourId && (parseFloat(v.montantTTC) || 0) > 0)
      .map((v) => ({
        sejourId: v.sejourId,
        montantTTC: parseFloat(v.montantTTC),
      }));
    if (ventilationExcessive) {
      setFormError('Le total ventilé dépasse le montant de la facture.');
      return;
    }

    const dto = {
      nomPrestataire: form.nomPrestataire.trim(),
      typeCharge: form.typeCharge,
      numeroFacture: form.numeroFacture.trim() || undefined,
      dateFacture: form.dateFacture || undefined,
      montantTotalTTC: montantTotal,
      notes: form.notes.trim() || undefined,
      ventilations: ventilationsValides,
    };

    setSaving(true);
    try {
      const saved = editingFacture
        ? await updateFacturePrestataire(editingFacture.id, dto)
        : await createFacturePrestataire(dto);
      if (file) {
        await uploadFichierFacturePrestataire(saved.id, file);
      }
      closeForm();
      await reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setFormError(msg || 'Erreur lors de l’enregistrement de la facture.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(f: FacturePrestataire) {
    if (!confirm(`Supprimer la facture de ${f.nomPrestataire} ?`)) return;
    try {
      await deleteFacturePrestataire(f.id);
      await reload();
    } catch {
      alert('Erreur lors de la suppression.');
    }
  }

  // Titre d'un séjour à partir de son id (pour l'affichage des ventilations)
  const sejourTitre = (id: string) =>
    sejoursDisponibles.find((s) => s.sejourId === id)?.titre ?? 'Séjour';

  if (isLoading || !user) return null;

  return (
    <div className="flex-1 min-w-0 flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <h1 className="text-base font-semibold text-gray-900">Rentabilité</h1>
        <button
          onClick={openCreate}
          className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          + Nouvelle facture
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6 w-full">
        {/* Onglets */}
        <div className="flex gap-1 border-b border-gray-200">
          <button
            onClick={() => setTab('tableau')}
            className={`-mb-px px-4 py-2 text-sm ${
              tab === 'tableau'
                ? 'border-b-2 border-[var(--color-primary)] font-medium text-[var(--color-primary)]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Tableau P&amp;L
          </button>
          <button
            onClick={() => setTab('factures')}
            className={`-mb-px px-4 py-2 text-sm ${
              tab === 'factures'
                ? 'border-b-2 border-[var(--color-primary)] font-medium text-[var(--color-primary)]'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Factures prestataires
          </button>
        </div>

        {/* ── Vue Tableau P&L ─────────────────────────────────────────── */}
        {tab === 'tableau' && (
          <>
            {/* Filtres */}
            <div className="flex items-center gap-3">
              <select
                value={annee}
                onChange={(e) => setAnnee(e.target.value)}
                className={inputCls + ' w-auto'}
              >
                {[
                  currentYear,
                  String(Number(currentYear) - 1),
                  String(Number(currentYear) - 2),
                ].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              <select
                value={mois}
                onChange={(e) => setMois(e.target.value)}
                className={inputCls + ' w-auto'}
              >
                <option value="">Tous les mois</option>
                {Array.from({ length: 12 }, (_, i) => {
                  const val = String(i + 1).padStart(2, '0');
                  const label = new Date(2000, i).toLocaleDateString('fr-FR', {
                    month: 'long',
                  });
                  return (
                    <option key={val} value={val}>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </option>
                  );
                })}
              </select>

              <select
                value={natureFilter}
                onChange={(e) =>
                  setNatureFilter(
                    e.target.value as 'TOUS' | 'SEJOUR' | 'EVENEMENT',
                  )
                }
                className={inputCls + ' w-auto'}
              >
                <option value="SEJOUR">Séjours</option>
                <option value="EVENEMENT">Événements</option>
                <option value="TOUS">Tous</option>
              </select>
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
              </div>
            ) : !tableau || sejoursFiltres.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-12">
                Aucun séjour sur cette période pour ce filtre.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500">
                      <th className="px-4 py-3">Séjour</th>
                      <th className="px-4 py-3">Dates</th>
                      <th className="px-4 py-3">Nature</th>
                      <th className="px-4 py-3 text-right">CA TTC</th>
                      <th className="px-4 py-3 text-right">Charges</th>
                      <th className="px-4 py-3 text-right">Marge</th>
                      <th className="px-4 py-3 text-right">Taux</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sejoursFiltres.map((ligne) => (
                      <tr
                        key={ligne.sejourId}
                        className="border-b border-gray-100 last:border-0"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {ligne.titre}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {fmtDate(ligne.dateDebut)} – {fmtDate(ligne.dateFin)}
                        </td>
                        <td className="px-4 py-3 text-gray-500">
                          {ligne.natureSejour === 'EVENEMENT'
                            ? 'Événement'
                            : 'Séjour'}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {ligne.caTTC === 0 ? '—' : fmtMontant(ligne.caTTC)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                          {fmtMontant(ligne.chargesTTC)}
                        </td>
                        <td
                          className="px-4 py-3 text-right tabular-nums font-medium"
                          style={
                            ligne.margeTTC < 0 ? { color: '#DC2626' } : undefined
                          }
                        >
                          {fmtMontant(ligne.margeTTC)}
                        </td>
                        <td
                          className="px-4 py-3 text-right tabular-nums font-medium"
                          style={
                            ligne.tauxMarge === null
                              ? { color: '#9CA3AF' }
                              : { color: tauxColor(ligne.tauxMarge) }
                          }
                        >
                          {fmtTaux(ligne.tauxMarge)}
                        </td>
                      </tr>
                    ))}
                    {/* Ligne TOTAL */}
                    <tr style={{ backgroundColor: '#F5F4F1' }} className="font-bold">
                      <td className="px-4 py-3 text-gray-900" colSpan={3}>
                        Total
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtMontant(totauxFiltres.caTTC)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtMontant(totauxFiltres.chargesTTC)}
                      </td>
                      <td
                        className="px-4 py-3 text-right tabular-nums"
                        style={
                          totauxFiltres.margeTTC < 0
                            ? { color: '#DC2626' }
                            : undefined
                        }
                      >
                        {fmtMontant(totauxFiltres.margeTTC)}
                      </td>
                      <td
                        className="px-4 py-3 text-right tabular-nums"
                        style={
                          totauxFiltres.tauxMarge === null
                            ? { color: '#9CA3AF' }
                            : { color: tauxColor(totauxFiltres.tauxMarge) }
                        }
                      >
                        {fmtTaux(totauxFiltres.tauxMarge)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Vue Factures prestataires ───────────────────────────────── */}
        {tab === 'factures' && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <button
                onClick={openCreate}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                + Nouvelle facture
              </button>
            </div>

            {factures.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-12">
                Aucune facture prestataire saisie.
              </p>
            ) : (
              <div className="space-y-2">
                {factures.map((f) => (
                  <div
                    key={f.id}
                    className="rounded-2xl border border-gray-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">
                            {f.nomPrestataire}
                          </p>
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                            {TYPE_CHARGE_LEGACY[f.typeCharge] ?? f.typeCharge}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {f.numeroFacture ? `N° ${f.numeroFacture} · ` : ''}
                          {f.dateFacture ? `${fmtDate(f.dateFacture)} · ` : ''}
                          {f.ventilations.length} ventilation
                          {f.ventilations.length > 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-gray-900 tabular-nums">
                          {fmtMontant(f.montantTotalTTC)}
                        </span>
                        <button
                          onClick={() => openEdit(f)}
                          className="text-xs text-[var(--color-primary)] hover:underline"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => handleDelete(f)}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>

                    {/* Détail ventilations */}
                    {f.ventilations.length > 0 && (
                      <div className="mt-3 space-y-1 border-t border-gray-100 pt-3">
                        {f.ventilations.map((v) => (
                          <div
                            key={v.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <span className="text-gray-600 truncate">
                              {sejourTitre(v.sejourId)}
                            </span>
                            <span className="tabular-nums text-gray-700">
                              {fmtMontant(v.montantTTC)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {f.fichierUrl && (
                      <a
                        href={f.fichierUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
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
                            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                          />
                        </svg>
                        Justificatif
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Modale formulaire facture ───────────────────────────────────── */}
      {formOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col"
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">
                {editingFacture
                  ? 'Modifier la facture'
                  : 'Nouvelle facture prestataire'}
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {formError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  Prestataire *
                </label>
                <input
                  value={form.nomPrestataire}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nomPrestataire: e.target.value }))
                  }
                  className={inputCls}
                  placeholder="Nom du prestataire"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Type de charge
                  </label>
                  <input
                    type="text"
                    list="typeChargeOptions"
                    value={form.typeCharge}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, typeCharge: e.target.value }))
                    }
                    className={inputCls}
                    placeholder="Ex: Rafting, Transport…"
                    autoComplete="off"
                  />
                  <datalist id="typeChargeOptions">
                    {TYPES_CHARGE_SUGGESTIONS.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Montant total TTC *
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.montantTotalTTC}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        montantTotalTTC: e.target.value,
                      }))
                    }
                    className={inputCls}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    N° de facture
                  </label>
                  <input
                    value={form.numeroFacture}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, numeroFacture: e.target.value }))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    Date de facture
                  </label>
                  <input
                    type="date"
                    value={form.dateFacture}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dateFacture: e.target.value }))
                    }
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, notes: e.target.value }))
                  }
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>

              {/* Ventilations */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">
                    Ventilation par séjour
                  </label>
                  <button
                    onClick={addVentilation}
                    className="text-xs text-[var(--color-primary)] hover:underline"
                  >
                    + Ajouter un séjour
                  </button>
                </div>

                {ventilations.length === 0 ? (
                  <p className="text-xs text-gray-400">
                    Aucune ventilation (facture non encore répartie).
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ventilations.map((v, i) => {
                      // Montant alloué aux AUTRES lignes (pas celle-ci)
                      const totalAutres = ventilations
                        .filter((_, j) => j !== i)
                        .reduce(
                          (s, r) => s + (parseFloat(r.montantTTC) || 0),
                          0,
                        );
                      const resteAAllouer = Math.max(
                        0,
                        montantTotal - totalAutres,
                      );
                      const peutToutAllouer =
                        montantTotal > 0 && resteAAllouer > 0;

                      return (
                        <div key={i} className="flex items-center gap-2">
                          <select
                            value={v.sejourId}
                            onChange={(e) =>
                              updateVentilation(i, 'sejourId', e.target.value)
                            }
                            className={`${inputCls} flex-1`}
                          >
                            <option value="">— Choisir un séjour —</option>
                            {sejoursDisponibles.map((s) => (
                              <option key={s.sejourId} value={s.sejourId}>
                                {s.titre} ({fmtDate(s.dateDebut)} –{' '}
                                {fmtDate(s.dateFin)})
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={v.montantTTC}
                            onChange={(e) =>
                              updateVentilation(i, 'montantTTC', e.target.value)
                            }
                            className={`${inputCls} w-28`}
                            placeholder="Montant"
                          />
                          {peutToutAllouer && (
                            <button
                              type="button"
                              title={`Allouer ${fmtMontant(resteAAllouer)}`}
                              onClick={() =>
                                updateVentilation(
                                  i,
                                  'montantTTC',
                                  resteAAllouer.toFixed(2),
                                )
                              }
                              className="shrink-0 text-xs text-[var(--color-primary)] hover:underline whitespace-nowrap"
                            >
                              = Tout
                            </button>
                          )}
                          <button
                            onClick={() => removeVentilation(i)}
                            className="text-gray-400 hover:text-red-500 shrink-0"
                            title="Retirer"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Récapitulatif ventilé */}
                {ventilations.length > 0 && (
                  <div
                    className={`mt-2 text-xs ${
                      ventilationExcessive ? 'text-red-600' : 'text-gray-500'
                    }`}
                  >
                    Ventilé : {fmtMontant(totalVentile)} / {fmtMontant(montantTotal)}
                    {ventilationExcessive &&
                      ' — dépasse le montant de la facture'}
                  </div>
                )}
              </div>

              {/* Justificatif */}
              <div className="pt-2">
                <label className="block text-xs text-gray-500 mb-1">
                  Justificatif (PDF, JPEG, PNG — max 10 Mo)
                </label>
                {/* Input caché — déclenché par le bouton ci-dessous */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
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
                        d="M18.375 12.739l-7.693 7.693a4.5 4.5 0 01-6.364-6.364l10.94-10.94A3 3 0 1119.5 7.372L8.552 18.32m.009-.01l-.01.01m5.699-9.941l-7.81 7.81a1.5 1.5 0 002.112 2.13"
                      />
                    </svg>
                    {file ? 'Changer le fichier' : 'Joindre une facture'}
                  </button>
                  {file && (
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">
                      {file.name}
                    </span>
                  )}
                  {!file && editingFacture?.fichierUrl && (
                    <a
                      href={editingFacture.fichierUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--color-primary)] hover:underline"
                    >
                      Voir le justificatif actuel
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={closeForm}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving || ventilationExcessive}
                className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
