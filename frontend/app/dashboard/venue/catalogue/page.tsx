'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getCatalogue, createProduit, updateProduit, archiveProduit, downloadTemplateCatalogue, importProduitsCatalogue, updateCapacitesProduit, getContraintesCentre, createContrainteCentre, deleteContrainteCentre } from '@/src/lib/centre';
import type { ProduitCatalogue, ContrainteCentre } from '@/src/lib/centre';

const TYPE_OPTIONS = [
  { value: 'HEBERGEMENT', label: 'Hébergement', color: 'bg-blue-100 text-blue-700' },
  { value: 'REPAS', label: 'Repas', color: 'bg-orange-100 text-orange-700' },
  { value: 'TRANSPORT', label: 'Transport', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'ACTIVITE', label: 'Activité', color: 'bg-green-100 text-green-700' },
  { value: 'AUTRE', label: 'Autre', color: 'bg-gray-100 text-gray-700' },
];

const UNITE_OPTIONS = [
  { value: 'PAR_ELEVE', label: 'Par élève' },
  { value: 'PAR_NUIT', label: 'Par nuit' },
  { value: 'PAR_JOUR', label: 'Par jour' },
  { value: 'FORFAIT', label: 'Forfait' },
];

const TVA_OPTIONS = [
  { value: 0, label: '0%' },
  { value: 5.5, label: '5.5%' },
  { value: 10, label: '10%' },
  { value: 20, label: '20%' },
];

const EMPTY_FORM = { nom: '', description: '', type: 'HEBERGEMENT', prixUnitaireHT: '', prixUnitaireTTC: '', tva: 10, unite: 'PAR_ELEVE', capaciteParGroupe: '', encadrementParGroupe: '', simultaneitePossible: true, dureeMinutes: '' };

export default function CataloguePage() {
  const { user, isLoading } = useAuth();
  const [produits, setProduits] = useState<ProduitCatalogue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; total: number } | null>(null);
  const [importErrors, setImportErrors] = useState<string | null>(null);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const [importPreview, setImportPreview] = useState<Omit<ProduitCatalogue, 'id' | 'actif' | 'createdAt'>[]>([]);
  const [filterType, setFilterType] = useState<string>('TOUS');
  const [dernierChampSaisi, setDernierChampSaisi] = useState<'HT' | 'TTC'>('HT');
  const [contraintes, setContraintes] = useState<ContrainteCentre[]>([]);
  const [contrainteForm, setContrainteForm] = useState({ libelle: '', type: 'BLOCAGE_CRENEAU', jourSemaine: '', heureDebut: '', heureFin: '' });
  const [savingContrainte, setSavingContrainte] = useState(false);
  const [showContraintesSection, setShowContraintesSection] = useState(false);

  useEffect(() => {
    if (!isLoading && user?.role === 'VENUE') {
      getCatalogue().then(setProduits).finally(() => setLoading(false));
      getContraintesCentre().then(setContraintes).catch(() => {});
    }
  }, [isLoading, user]);

  const handleSubmit = async () => {
    if (!form.nom || !form.prixUnitaireHT) return;
    setSaving(true);
    try {
      const dto = {
        nom: form.nom,
        description: form.description || undefined,
        type: form.type as ProduitCatalogue['type'],
        prixUnitaireHT: Number(form.prixUnitaireHT),
        prixUnitaireTTC: form.prixUnitaireTTC ? Number(form.prixUnitaireTTC) : undefined,
        tva: Number(form.tva),
        unite: form.unite as ProduitCatalogue['unite'],
        ...(form.type === 'ACTIVITE' && {
          capaciteParGroupe: form.capaciteParGroupe ? Number(form.capaciteParGroupe) : undefined,
          encadrementParGroupe: form.encadrementParGroupe ? Number(form.encadrementParGroupe) : undefined,
          simultaneitePossible: form.simultaneitePossible,
          dureeMinutes: form.dureeMinutes ? Number(form.dureeMinutes) : undefined,
        }),
      };
      if (editingId) {
        const updated = await updateProduit(editingId, dto);
        if (form.type === 'ACTIVITE') {
          await updateCapacitesProduit(editingId, {
            capaciteParGroupe: form.capaciteParGroupe ? Number(form.capaciteParGroupe) : null,
            encadrementParGroupe: form.encadrementParGroupe ? Number(form.encadrementParGroupe) : null,
            simultaneitePossible: form.simultaneitePossible,
            dureeMinutes: form.dureeMinutes ? Number(form.dureeMinutes) : null,
          });
        }
        setProduits(prev => prev.map(p => p.id === editingId ? updated : p));
      } else {
        const created = await createProduit(dto);
        setProduits(prev => [...prev, created]);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (p: ProduitCatalogue) => {
    const ttc = p.prixUnitaireTTC != null ? p.prixUnitaireTTC : Math.round(p.prixUnitaireHT * (1 + p.tva / 100) * 100) / 100;
    setForm({
      nom: p.nom,
      description: p.description ?? '',
      type: p.type,
      prixUnitaireHT: String(p.prixUnitaireHT),
      prixUnitaireTTC: String(ttc),
      tva: p.tva,
      unite: p.unite,
      capaciteParGroupe: p.capaciteParGroupe != null ? String(p.capaciteParGroupe) : '',
      encadrementParGroupe: p.encadrementParGroupe != null ? String(p.encadrementParGroupe) : '',
      simultaneitePossible: p.simultaneitePossible ?? true,
      dureeMinutes: p.dureeMinutes != null ? String(p.dureeMinutes) : '',
    });
    setEditingId(p.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleHTChange = (value: string) => {
    setDernierChampSaisi('HT');
    const ht = parseFloat(value) || 0;
    const ttc = ht * (1 + form.tva / 100);
    setForm(f => ({ ...f, prixUnitaireHT: value, prixUnitaireTTC: ht > 0 ? ttc.toFixed(2) : '' }));
  };

  const handleTTCChange = (value: string) => {
    setDernierChampSaisi('TTC');
    const ttc = parseFloat(value) || 0;
    const ht = ttc / (1 + form.tva / 100);
    setForm(f => ({ ...f, prixUnitaireTTC: value, prixUnitaireHT: ttc > 0 ? ht.toFixed(2) : '' }));
  };

  const handleTvaChange = (value: number) => {
    if (dernierChampSaisi === 'TTC') {
      const ttc = parseFloat(form.prixUnitaireTTC) || 0;
      const ht = ttc > 0 ? ttc / (1 + value / 100) : 0;
      setForm(f => ({ ...f, tva: value, prixUnitaireHT: ht > 0 ? ht.toFixed(2) : f.prixUnitaireHT }));
    } else {
      const ht = parseFloat(form.prixUnitaireHT) || 0;
      const ttc = ht > 0 ? ht * (1 + value / 100) : 0;
      setForm(f => ({ ...f, tva: value, prixUnitaireTTC: ttc > 0 ? ttc.toFixed(2) : f.prixUnitaireTTC }));
    }
  };

  const handleArchive = async (id: string) => {
    await archiveProduit(id);
    setProduits(prev => prev.filter(p => p.id !== id));
  };

  const handleAddContrainte = async () => {
    if (!contrainteForm.libelle) return;
    setSavingContrainte(true);
    try {
      const c = await createContrainteCentre({
        libelle: contrainteForm.libelle,
        type: contrainteForm.type,
        jourSemaine: contrainteForm.jourSemaine ? Number(contrainteForm.jourSemaine) : undefined,
        heureDebut: contrainteForm.heureDebut || undefined,
        heureFin: contrainteForm.heureFin || undefined,
      });
      setContraintes(prev => [...prev, c]);
      setContrainteForm({ libelle: '', type: 'BLOCAGE_CRENEAU', jourSemaine: '', heureDebut: '', heureFin: '' });
    } finally {
      setSavingContrainte(false);
    }
  };

  const handleDeleteContrainte = async (id: string) => {
    await deleteContrainteCentre(id);
    setContraintes(prev => prev.filter(c => c.id !== id));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportErrors(null);
    setImportResult(null);

    const reader = new FileReader();

    reader.onload = async (ev) => {
      try {
        const XLSX = await import('xlsx');

        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];

        const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

        const filtered = raw.filter(r => {
          const nom = String(r['Nom'] ?? '').trim();
          return nom && !nom.startsWith('---') && nom !== 'Type:' && nom !== 'Unité:' && nom !== 'TVA (%):' && nom !== 'Prix HT :';
        });

        if (filtered.length === 0) {
          setImportErrors('Aucune ligne valide détectée. Vérifiez que le fichier contient les en-têtes : Nom, Type, Prix TTC (€), TVA (%), Unité.');
          return;
        }

        const VALID_TYPES = new Set(['HEBERGEMENT', 'REPAS', 'TRANSPORT', 'ACTIVITE', 'AUTRE']);
        const VALID_UNITES = new Set(['PAR_ELEVE', 'PAR_NUIT', 'PAR_JOUR', 'FORFAIT']);
        const VALID_TVA = [0, 5.5, 10, 20];

        const rows: Omit<ProduitCatalogue, 'id' | 'actif' | 'createdAt'>[] = [];
        const errors: string[] = [];

        filtered.forEach((r, i) => {
          const nom = String(r['Nom'] ?? '').trim();
          const type = String(r['Type'] ?? '').trim().toUpperCase();
          const prixTTC = parseFloat(String(r['Prix TTC (€)'] ?? '0'));
          const tva = parseFloat(String(r['TVA (%)'] ?? '0'));
          const unite = String(r['Unité'] ?? '').trim().toUpperCase();
          const description = String(r['Description'] ?? '').trim() || undefined;

          // Prix HT calculé depuis TTC + TVA — la colonne HT du fichier est ignorée
          const prixHT = tva === 0 ? prixTTC : Math.round((prixTTC / (1 + tva / 100)) * 100) / 100;

          if (!nom) { errors.push(`Ligne ${i + 2} : nom manquant`); return; }
          if (!VALID_TYPES.has(type)) { errors.push(`Ligne ${i + 2} (${nom}) : type invalide "${type}"`); return; }
          if (isNaN(prixTTC) || prixTTC < 0) { errors.push(`Ligne ${i + 2} (${nom}) : prix TTC invalide`); return; }
          if (!VALID_TVA.includes(tva)) { errors.push(`Ligne ${i + 2} (${nom}) : TVA invalide "${tva}" — valeurs acceptées : 0, 5.5, 10, 20`); return; }
          if (!VALID_UNITES.has(unite)) { errors.push(`Ligne ${i + 2} (${nom}) : unité invalide "${unite}"`); return; }

          rows.push({
            nom,
            type: type as ProduitCatalogue['type'],
            prixUnitaireHT: prixHT,
            prixUnitaireTTC: prixTTC,
            tva,
            unite: unite as ProduitCatalogue['unite'],
            description,
          });
        });

        if (errors.length > 0) {
          setImportErrors(
            `${errors.length} erreur(s) détectée(s) :\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... et ${errors.length - 5} autre(s)` : ''}`
          );
          if (rows.length === 0) return;
        }

        setImportPreview(rows);
        setShowImportPreview(true);
      } catch {
        setImportErrors('Impossible de lire le fichier. Assurez-vous d\'utiliser le modèle Excel fourni (.xlsx).');
      }
    };

    // readAsArrayBuffer — ne pas changer (xlsx est un ZIP binaire)
    reader.readAsArrayBuffer(file);

    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    setImporting(true);
    try {
      const result = await importProduitsCatalogue(importPreview);
      setImportResult(result);
      setShowImportPreview(false);
      const updated = await getCatalogue();
      setProduits(updated);
    } catch {
      setImportErrors('Erreur lors de l\'import. Vérifiez le format du fichier.');
    } finally {
      setImporting(false);
    }
  };

  const filtered = filterType === 'TOUS' ? produits : produits.filter(p => p.type === filterType);
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2 });

  if (isLoading || !user) return null;

  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      {/* Nav */}
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <Link href="/dashboard/venue" className="text-sm text-[var(--color-primary)] hover:underline">&larr; Tableau de bord</Link>
        <h1 className="text-base font-semibold text-gray-900">Catalogue produits</h1>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* Header actions */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            {['TOUS', ...TYPE_OPTIONS.map(t => t.value)].map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${filterType === type ? 'bg-[var(--color-primary)] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[var(--color-primary)]'}`}
              >
                {type === 'TOUS' ? 'Tous' : TYPE_OPTIONS.find(t => t.value === type)?.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadTemplateCatalogue}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Modèle Excel
            </button>

            <label className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Importer Excel
              <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileUpload} />
            </label>

            <button
              onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
              className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Ajouter un produit
            </button>
          </div>
        </div>

        {/* Formulaire */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">{editingId ? 'Modifier le produit' : 'Nouveau produit'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Nom du produit *</label>
                <input
                  value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="ex: Forfait ski J1, Hébergement nuit..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Unité *</label>
                <select
                  value={form.unite}
                  onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {UNITE_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prix unitaire HT (&euro;) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.prixUnitaireHT}
                  onChange={e => handleHTChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Prix unitaire TTC (&euro;)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.prixUnitaireTTC}
                  onChange={e => handleTTCChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">TVA *</label>
                <select
                  value={form.tva}
                  onChange={e => handleTvaChange(Number(e.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                >
                  {TVA_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Description (optionnel)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Détails du produit..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] resize-none"
                />
              </div>
            </div>
            {form.type === 'ACTIVITE' && (
              <div className="col-span-2 border-t border-gray-100 pt-3 mt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Paramètres groupes &amp; planning IA</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Capacité par groupe <span className="text-gray-400 font-normal">(nb élèves max)</span></label>
                    <input type="number" min="1" value={form.capaciteParGroupe}
                      onChange={e => setForm(f => ({ ...f, capaciteParGroupe: e.target.value }))}
                      placeholder="ex: 8"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Encadrement requis <span className="text-gray-400 font-normal">(accompagnants)</span></label>
                    <input type="number" min="1" value={form.encadrementParGroupe}
                      onChange={e => setForm(f => ({ ...f, encadrementParGroupe: e.target.value }))}
                      placeholder="ex: 1"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Durée <span className="text-gray-400 font-normal">(minutes)</span></label>
                    <input type="number" min="30" step="30" value={form.dureeMinutes}
                      onChange={e => setForm(f => ({ ...f, dureeMinutes: e.target.value }))}
                      placeholder="ex: 180"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input type="checkbox" id="simultaneite" checked={form.simultaneitePossible}
                      onChange={e => setForm(f => ({ ...f, simultaneitePossible: e.target.checked }))}
                      className="rounded border-gray-300 text-[var(--color-primary)]" />
                    <label htmlFor="simultaneite" className="text-xs text-gray-700">Plusieurs groupes simultanés possibles</label>
                  </div>
                </div>
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={handleSubmit} disabled={saving} className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {saving ? 'Enregistrement...' : editingId ? 'Mettre à jour' : 'Ajouter au catalogue'}
              </button>
              <button onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Annuler
              </button>
            </div>
          </div>
        )}

        {importResult && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
            {importResult.imported} produit{importResult.imported > 1 ? 's' : ''} importé{importResult.imported > 1 ? 's' : ''} sur {importResult.total} lignes.
          </div>
        )}

        {importErrors && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {importErrors}
          </div>
        )}

        {showImportPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-sm font-semibold text-gray-900">Aperçu de l&apos;import — {importPreview.length} produit{importPreview.length > 1 ? 's' : ''} détecté{importPreview.length > 1 ? 's' : ''}</h2>
                <p className="text-xs text-gray-500 mt-0.5">Vérifiez les données avant de confirmer l&apos;import.</p>
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-1.5 font-medium text-gray-600">Nom</th>
                      <th className="text-left py-1.5 font-medium text-gray-600">Type</th>
                      <th className="text-right py-1.5 font-medium text-gray-600">Prix HT</th>
                      <th className="text-right py-1.5 font-medium text-gray-600">TVA</th>
                      <th className="text-left py-1.5 font-medium text-gray-600">Unité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importPreview.map((p, i) => (
                      <tr key={i} className="border-b border-gray-50">
                        <td className="py-1.5 text-gray-900">{p.nom}</td>
                        <td className="py-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_OPTIONS.find(t => t.value === p.type)?.color ?? 'bg-gray-100 text-gray-600'}`}>
                            {TYPE_OPTIONS.find(t => t.value === p.type)?.label ?? p.type}
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-gray-700">{p.prixUnitaireHT.toFixed(2)} &euro;</td>
                        <td className="py-1.5 text-right text-gray-500">{p.tva}%</td>
                        <td className="py-1.5 text-gray-500">{UNITE_OPTIONS.find(u => u.value === p.unite)?.label ?? p.unite}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex gap-3">
                <button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="flex-1 rounded-lg bg-[var(--color-primary)] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {importing ? 'Import en cours...' : `Confirmer l'import (${importPreview.length} produits)`}
                </button>
                <button
                  onClick={() => setShowImportPreview(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Liste produits */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">Aucun produit dans votre catalogue.</p>
            <p className="text-xs mt-1">Ajoutez vos prestations pour les réutiliser dans vos devis.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => {
              const typeOpt = TYPE_OPTIONS.find(t => t.value === p.type);
              const uniteOpt = UNITE_OPTIONS.find(u => u.value === p.unite);
              const prixTTC = p.prixUnitaireTTC ?? Math.round(p.prixUnitaireHT * (1 + p.tva / 100) * 100) / 100;
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${typeOpt?.color}`}>
                      {typeOpt?.label}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{p.nom}</p>
                      {p.description && <p className="text-xs text-gray-500 truncate">{p.description}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{fmt(p.prixUnitaireHT)} &euro; HT</p>
                      <p className="text-xs text-gray-500">{fmt(prixTTC)} &euro; TTC &middot; TVA {p.tva}% &middot; {uniteOpt?.label}</p>
                      {p.type === 'ACTIVITE' && (p.capaciteParGroupe || p.dureeMinutes) && (
                        <p className="text-xs text-[var(--color-primary)] mt-0.5">
                          {p.capaciteParGroupe ? `${p.capaciteParGroupe} élèves/groupe` : ''}
                          {p.capaciteParGroupe && p.encadrementParGroupe ? ` + ${p.encadrementParGroupe} encadrant` : ''}
                          {p.dureeMinutes ? ` · ${p.dureeMinutes} min` : ''}
                          {p.simultaneitePossible === false ? ' · groupes non simultanés' : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(p)} className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-[var(--color-primary)] hover:border-[var(--color-primary)]">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
                        </svg>
                      </button>
                      <button onClick={() => handleArchive(p.id)} className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-red-500 hover:border-red-300">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Contraintes centre ── */}
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Contraintes récurrentes du centre</h2>
              <p className="text-xs text-gray-500 mt-0.5">Blocages réguliers qui s&apos;appliquent à tous les séjours (marché hebdomadaire, fermeture annuelle...)</p>
            </div>
            <button onClick={() => setShowContraintesSection(s => !s)}
              className="text-xs text-[var(--color-primary)] hover:underline">
              {showContraintesSection ? 'Masquer' : 'Gérer'}
            </button>
          </div>

          {contraintes.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {contraintes.map(c => {
                const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
                const label = [
                  c.type === 'BLOCAGE_CRENEAU' ? '🚫' : '📌',
                  c.libelle,
                  c.jourSemaine != null ? JOURS[c.jourSemaine] : null,
                  c.heureDebut && c.heureFin ? `${c.heureDebut}-${c.heureFin}` : null,
                ].filter(Boolean).join(' · ');
                return (
                  <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs text-amber-800">
                    {label}
                    <button onClick={() => handleDeleteContrainte(c.id)} className="text-amber-400 hover:text-red-500">&times;</button>
                  </span>
                );
              })}
            </div>
          )}

          {showContraintesSection && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Libellé *</label>
                  <input value={contrainteForm.libelle}
                    onChange={e => setContrainteForm(f => ({ ...f, libelle: e.target.value }))}
                    placeholder="ex: Marché hebdomadaire, Fermeture annuelle..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                  <select value={contrainteForm.type}
                    onChange={e => setContrainteForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                    <option value="BLOCAGE_CRENEAU">Blocage créneau</option>
                    <option value="ACTIVITE_RESERVEE">Activité réservée</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Jour de la semaine</label>
                  <select value={contrainteForm.jourSemaine}
                    onChange={e => setContrainteForm(f => ({ ...f, jourSemaine: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]">
                    <option value="">Tous les jours</option>
                    <option value="1">Lundi</option>
                    <option value="2">Mardi</option>
                    <option value="3">Mercredi</option>
                    <option value="4">Jeudi</option>
                    <option value="5">Vendredi</option>
                    <option value="6">Samedi</option>
                    <option value="0">Dimanche</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Heure début</label>
                  <input type="time" value={contrainteForm.heureDebut}
                    onChange={e => setContrainteForm(f => ({ ...f, heureDebut: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Heure fin</label>
                  <input type="time" value={contrainteForm.heureFin}
                    onChange={e => setContrainteForm(f => ({ ...f, heureFin: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]" />
                </div>
              </div>
              <button onClick={handleAddContrainte} disabled={savingContrainte || !contrainteForm.libelle}
                className="w-full rounded-lg bg-[var(--color-primary)] py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
                {savingContrainte ? 'Ajout...' : 'Ajouter la contrainte'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
