'use client';

import { useEffect, useState } from 'react';
import { updateInfosSejour } from '@/src/lib/collaboration';
import { TRANSPORT_ALLER_OPTIONS } from '@/src/components/sejour/shared';

// Les 8 champs TOUS optionnels/nullable : absorbe les deux sources hétérogènes
// (devis.sejourDirect vs devis.demande.sejour) sans erreur d'assignabilité.
export interface DetailsSejour {
  niveauClasse?: string | null;
  heureArrivee?: string | null;
  heureDepart?: string | null;
  transportAller?: string | null;
  transportSurPlace?: boolean | null;
  activitesSouhaitees?: string | null;
  budgetMaxParEleve?: number | null;
  noteDateFlexible?: string | null;
}

interface DetailsSejourPanelProps {
  details: DetailsSejour | null;
  sejourId?: string;
  editable: boolean;
  onSaved?: () => void;
}

const LABELS: { key: keyof DetailsSejour; label: string }[] = [
  { key: 'niveauClasse', label: 'Niveau' },
  { key: 'heureArrivee', label: 'Arrivée' },
  { key: 'heureDepart', label: 'Départ' },
  { key: 'transportAller', label: 'Transport aller' },
  { key: 'transportSurPlace', label: 'Transport sur place' },
  { key: 'activitesSouhaitees', label: 'Activités souhaitées' },
  { key: 'budgetMaxParEleve', label: 'Budget max / participant' },
  { key: 'noteDateFlexible', label: 'Note dates' },
];

function hasValue(key: keyof DetailsSejour, v: DetailsSejour[keyof DetailsSejour]): boolean {
  if (key === 'transportSurPlace') return v === true || v === false;
  return v !== null && v !== undefined && v !== '';
}

function affiche(key: keyof DetailsSejour, v: DetailsSejour[keyof DetailsSejour]): string {
  if (key === 'transportSurPlace') return v ? 'Oui' : 'Non';
  // Colonne Decimal probable (pattern LIAVO montantTTC) : Number() puis format FR.
  if (key === 'budgetMaxParEleve') return `${Number(v).toLocaleString('fr-FR')} €`;
  if (key === 'transportAller') return TRANSPORT_ALLER_OPTIONS.find(o => o.value === v)?.label ?? String(v);
  return String(v);
}

interface FormState {
  niveauClasse: string;
  heureArrivee: string;
  heureDepart: string;
  transportAller: string;
  transportSurPlace: boolean;
  activitesSouhaitees: string;
  budgetMaxParEleve: string;
  noteDateFlexible: string;
}

const toForm = (d: DetailsSejour): FormState => ({
  niveauClasse: d.niveauClasse ?? '',
  heureArrivee: d.heureArrivee ?? '',
  heureDepart: d.heureDepart ?? '',
  transportAller: d.transportAller ?? '',
  transportSurPlace: d.transportSurPlace ?? false,
  activitesSouhaitees: d.activitesSouhaitees ?? '',
  budgetMaxParEleve: d.budgetMaxParEleve != null ? String(d.budgetMaxParEleve) : '',
  noteDateFlexible: d.noteDateFlexible ?? '',
});

export default function DetailsSejourPanel({ details, sejourId, editable, onSaved }: DetailsSejourPanelProps) {
  const [open, setOpen] = useState(true); // ouvert par défaut
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState<DetailsSejour>(details ?? {});
  const [form, setForm] = useState<FormState>(toForm(details ?? {}));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Le parent ne recharge pas après save (édition optimiste) ; on suit tout de
  // même une éventuelle nouvelle source (navigation, refetch parent).
  useEffect(() => {
    setData(details ?? {});
  }, [details]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const startEdit = () => {
    setForm(toForm(data));
    setError(null);
    setEditing(true);
  };

  const handleSave = async () => {
    if (!sejourId) return;
    setSaving(true);
    setError(null);
    const budgetStr = form.budgetMaxParEleve.trim();
    const budgetNum = Number(budgetStr);
    // '' → null (effacer) ; nombre valide → number ; saisie NaN → undefined (ne pas toucher)
    const budgetPayload: number | null | undefined =
      budgetStr === '' ? null : (Number.isNaN(budgetNum) ? undefined : budgetNum);
    try {
      await updateInfosSejour(sejourId, {
        niveauClasse: form.niveauClasse,
        heureArrivee: form.heureArrivee,
        heureDepart: form.heureDepart,
        transportAller: form.transportAller,
        transportSurPlace: form.transportSurPlace,
        activitesSouhaitees: form.activitesSouhaitees,
        ...(budgetPayload !== undefined && { budgetMaxParEleve: budgetPayload }),
        noteDateFlexible: form.noteDateFlexible,
      });
      setData({
        niveauClasse: form.niveauClasse || null,
        heureArrivee: form.heureArrivee || null,
        heureDepart: form.heureDepart || null,
        transportAller: form.transportAller || null,
        transportSurPlace: form.transportSurPlace,
        activitesSouhaitees: form.activitesSouhaitees || null,
        budgetMaxParEleve: budgetPayload === undefined ? (data.budgetMaxParEleve ?? null) : budgetPayload,
        noteDateFlexible: form.noteDateFlexible || null,
      });
      setEditing(false);
      onSaved?.();
    } catch {
      setError('Échec de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Détails du séjour"
        style={{ writingMode: 'vertical-rl' }}
        className="fixed right-0 top-1/2 z-[60] -translate-y-1/2 rounded-l-lg bg-[var(--color-primary)] px-2 py-3 text-xs font-medium text-white shadow-lg transition hover:opacity-90 print:hidden"
      >
        Détails du séjour
      </button>
    );
  }

  const rows = LABELS.filter(({ key }) => hasValue(key, data[key]));
  const inputCls = 'w-full rounded border border-gray-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]';

  return (
    <div className="fixed right-0 top-20 z-[60] max-h-[80vh] w-[340px] overflow-y-auto rounded-l-2xl border border-gray-200 bg-white shadow-2xl transition print:hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Détails du séjour</h3>
        <div className="flex items-center gap-3">
          {editable && !editing && (
            <button type="button" onClick={startEdit} className="text-xs font-medium text-[var(--color-primary)] hover:underline">
              Modifier
            </button>
          )}
          <button type="button" onClick={() => setOpen(false)} title="Réduire" className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>
      </div>

      <div className="space-y-2 p-4 text-xs">
        {editing ? (
          <div className="space-y-2">
            <label className="block">
              <span className="text-gray-500">Niveau</span>
              <input value={form.niveauClasse} onChange={e => set('niveauClasse', e.target.value)} className={inputCls} placeholder="ex : 6ème · 11-14 ans" />
            </label>
            <div className="flex gap-2">
              <label className="block flex-1">
                <span className="text-gray-500">Arrivée</span>
                <input value={form.heureArrivee} onChange={e => set('heureArrivee', e.target.value)} className={inputCls} placeholder="ex : 10h" />
              </label>
              <label className="block flex-1">
                <span className="text-gray-500">Départ</span>
                <input value={form.heureDepart} onChange={e => set('heureDepart', e.target.value)} className={inputCls} placeholder="ex : 16h" />
              </label>
            </div>
            <label className="block">
              <span className="text-gray-500">Transport aller</span>
              <select value={form.transportAller} onChange={e => set('transportAller', e.target.value)} className={inputCls}>
                <option value="">— Non renseigné —</option>
                {TRANSPORT_ALLER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.transportSurPlace} onChange={e => set('transportSurPlace', e.target.checked)} className="rounded" />
              <span className="text-gray-700">Transport sur place</span>
            </label>
            <label className="block">
              <span className="text-gray-500">Activités souhaitées</span>
              <textarea value={form.activitesSouhaitees} onChange={e => set('activitesSouhaitees', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
            </label>
            <label className="block">
              <span className="text-gray-500">Budget max / participant (€)</span>
              <input type="number" step="any" value={form.budgetMaxParEleve} onChange={e => set('budgetMaxParEleve', e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="text-gray-500">Note dates</span>
              <textarea value={form.noteDateFlexible} onChange={e => set('noteDateFlexible', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
            </label>

            {error && <p className="rounded bg-red-50 px-2 py-1 text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className="rounded border border-gray-300 px-3 py-1 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Annuler
              </button>
              <button type="button" onClick={handleSave} disabled={saving} className="rounded bg-[var(--color-primary)] px-3 py-1 font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <p className="italic text-gray-400">Aucun détail renseigné</p>
        ) : (
          rows.map(({ key, label }) => (
            <div key={key} className="flex justify-between gap-3">
              <span className="text-gray-500">{label}</span>
              <span className="text-right text-gray-800">{affiche(key, data[key])}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
