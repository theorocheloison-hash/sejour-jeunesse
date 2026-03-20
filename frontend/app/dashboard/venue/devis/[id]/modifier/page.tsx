'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getDevisDetail, updateDevis } from '@/src/lib/devis';
import type { Devis, LigneDevis } from '@/src/lib/devis';

// ─── Constants ──────────────────────────────────────────────────────────────

const TVA_OPTIONS = [
  { value: 0, label: '0 %' },
  { value: 5.5, label: '5,5 %' },
  { value: 10, label: '10 %' },
  { value: 20, label: '20 %' },
];

type LigneForm = {
  key: string;
  description: string;
  quantite: string;
  prixUnitaire: string;
  tva: string;
};

let keyCounter = 0;
function newKey() { return `l-${++keyCounter}`; }

function makeLigneForm(desc = '', qte = '', prix = '', tva = '0'): LigneForm {
  return { key: newKey(), description: desc, quantite: qte, prixUnitaire: prix, tva };
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ModifierDevisPage() {
  const router = useRouter();
  const params = useParams();
  const devisId = params.id as string;
  const { user, isLoading } = useAuth();

  // Data
  const [devisOriginal, setDevisOriginal] = useState<Devis | null>(null);
  const [centre, setCentre] = useState<{ id: string; nom: string; adresse: string; ville: string; codePostal: string; telephone?: string | null; email?: string | null } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Company info
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [adresseEntreprise, setAdresseEntreprise] = useState('');
  const [siretEntreprise, setSiretEntreprise] = useState('');
  const [emailEntreprise, setEmailEntreprise] = useState('');
  const [telEntreprise, setTelEntreprise] = useState('');

  // Lines
  const [lignes, setLignes] = useState<LigneForm[]>([]);

  // Global TVA + acompte
  const [tauxTva, setTauxTva] = useState(0);
  const [pourcentageAcompte, setPourcentageAcompte] = useState(30);
  const [numeroDevis, setNumeroDevis] = useState('');

  // Conditions
  const [conditionsAnnulation, setConditionsAnnulation] = useState('');
  const [validiteJours] = useState(30);

  // Submit state
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Auth guard ──
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'VENUE')) router.replace('/login');
  }, [isLoading, user, router]);

  // ── Load existing devis ──
  useEffect(() => {
    if (!user || !devisId) return;
    getDevisDetail(devisId)
      .then(({ devis, centre: c }) => {
        setDevisOriginal(devis);
        setCentre(c);
        // Pre-fill fields
        setNomEntreprise(devis.nomEntreprise ?? c.nom);
        setAdresseEntreprise(devis.adresseEntreprise ?? `${c.adresse}, ${c.codePostal} ${c.ville}`);
        setSiretEntreprise(devis.siretEntreprise ?? '');
        setEmailEntreprise(devis.emailEntreprise ?? c.email ?? '');
        setTelEntreprise(devis.telEntreprise ?? c.telephone ?? '');
        setTauxTva(devis.tauxTva ?? 0);
        setPourcentageAcompte(devis.pourcentageAcompte ?? 30);
        setNumeroDevis(devis.numeroDevis ?? '');
        setConditionsAnnulation(devis.conditionsAnnulation ?? '');
        // Pre-fill lignes
        if (devis.lignes && devis.lignes.length > 0) {
          setLignes(devis.lignes.map((l: LigneDevis) =>
            makeLigneForm(l.description, String(l.quantite), String(l.prixUnitaire), String(l.tva))
          ));
        } else {
          setLignes([makeLigneForm()]);
        }
      })
      .catch(() => setLoadError('Impossible de charger le devis.'));
  }, [user, devisId]);

  // ── Calculations ──
  const calculs = useMemo(() => {
    let sousTotal = 0;
    lignes.forEach((l) => {
      const qte = parseFloat(l.quantite) || 0;
      const pu = parseFloat(l.prixUnitaire) || 0;
      sousTotal += qte * pu;
    });

    const montantHT = sousTotal;
    const montantTVA = sousTotal * (tauxTva / 100);
    const montantTTC = montantHT + montantTVA;
    const montantAcompte = montantTTC * (pourcentageAcompte / 100);
    const resteAPayer = montantTTC - montantAcompte;

    return { montantHT, montantTVA, montantTTC, montantAcompte, resteAPayer };
  }, [lignes, tauxTva, pourcentageAcompte]);

  // ── Line handlers ──
  const updateLigne = useCallback((key: string, field: keyof LigneForm, value: string) => {
    setLignes((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }, []);

  const addLigne = useCallback(() => {
    setLignes((prev) => [...prev, makeLigneForm()]);
  }, []);

  const removeLigne = useCallback((key: string) => {
    setLignes((prev) => prev.filter((l) => l.key !== key));
  }, []);

  // ── Submit ──
  const handleSubmit = async () => {
    if (!devisOriginal) return;
    setSending(true);

    const lignesData = lignes
      .filter((l) => l.description && (parseFloat(l.prixUnitaire) || 0) > 0)
      .map((l) => {
        const qte = parseFloat(l.quantite) || 0;
        const pu = parseFloat(l.prixUnitaire) || 0;
        const tvaL = parseFloat(l.tva) || 0;
        const ht = qte * pu;
        const ttc = ht * (1 + tvaL / 100);
        return { description: l.description, quantite: qte, prixUnitaire: pu, tva: tvaL, totalHT: ht, totalTTC: ttc };
      });

    const nombreEleves = devisOriginal.demande?.nombreEleves || 1;

    try {
      await updateDevis(devisId, {
        montantTotal: calculs.montantTTC.toFixed(2),
        montantParEleve: (calculs.montantTTC / nombreEleves).toFixed(2),
        description: devisOriginal.description ?? undefined,
        conditionsAnnulation,
        nomEntreprise,
        adresseEntreprise,
        siretEntreprise: siretEntreprise || undefined,
        emailEntreprise: emailEntreprise || undefined,
        telEntreprise: telEntreprise || undefined,
        tauxTva,
        montantHT: calculs.montantHT,
        montantTVA: calculs.montantTVA,
        montantTTC: calculs.montantTTC,
        pourcentageAcompte,
        montantAcompte: calculs.montantAcompte,
        numeroDevis,
        typeDevis: devisOriginal.typeDevis ?? 'PLATEFORME',
        lignes: lignesData,
      });
      setSuccess(true);
    } catch {
      setLoadError('Erreur lors de la modification du devis.');
    } finally {
      setSending(false);
    }
  };

  // ── Loading ──
  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center max-w-md">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success-light)] mb-4">
            <svg className="h-7 w-7 text-[var(--color-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Devis modifié !</h2>
          <p className="text-sm text-gray-500 mb-6">Votre devis {numeroDevis} a été mis à jour.</p>
          <Link href="/dashboard/venue/devis" className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-colors">
            Voir mes devis
          </Link>
        </div>
      </div>
    );
  }

  if (!devisOriginal && !loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  const demande = devisOriginal?.demande;
  const sejour = demande?.sejour;

  const dateDevis = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const dateValidite = new Date(Date.now() + validiteJours * 86400000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/venue/devis" className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)] font-medium">&larr; Retour aux devis</Link>
            </div>
            <span className="text-sm font-semibold text-gray-700">Modifier le devis</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{loadError}</div>
        )}

        {/* ═══ DEVIS DOCUMENT ═══════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* ── Section 1 : En-tête ───────────────────────────────────────── */}
          <div className="px-8 pt-8 pb-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between gap-6">
              <div className="flex-1 space-y-3">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Émetteur</h2>
                <input value={nomEntreprise} onChange={(e) => setNomEntreprise(e.target.value)}
                  placeholder="Nom de l'entreprise" className="w-full text-lg font-bold text-gray-900 border-0 border-b border-gray-200 focus:border-[var(--color-border-strong)] focus:ring-0 px-0 py-1" />
                <textarea value={adresseEntreprise} onChange={(e) => setAdresseEntreprise(e.target.value)}
                  placeholder="Adresse complète" rows={2} className="w-full text-sm text-gray-600 border-0 border-b border-gray-200 focus:border-[var(--color-border-strong)] focus:ring-0 px-0 py-1 resize-none" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input value={siretEntreprise} onChange={(e) => setSiretEntreprise(e.target.value)}
                    placeholder="SIRET" className="text-sm text-gray-600 border-0 border-b border-gray-200 focus:border-[var(--color-border-strong)] focus:ring-0 px-0 py-1" />
                  <input value={emailEntreprise} onChange={(e) => setEmailEntreprise(e.target.value)}
                    placeholder="Email" type="email" className="text-sm text-gray-600 border-0 border-b border-gray-200 focus:border-[var(--color-border-strong)] focus:ring-0 px-0 py-1" />
                  <input value={telEntreprise} onChange={(e) => setTelEntreprise(e.target.value)}
                    placeholder="Téléphone" className="text-sm text-gray-600 border-0 border-b border-gray-200 focus:border-[var(--color-border-strong)] focus:ring-0 px-0 py-1" />
                </div>
              </div>
              <div className="sm:text-right space-y-2 shrink-0">
                <h1 className="text-2xl font-extrabold text-[var(--color-primary)]">DEVIS</h1>
                <p className="text-sm text-gray-500">N° <span className="font-mono font-semibold text-gray-900">{numeroDevis}</span></p>
                <p className="text-sm text-gray-500">Date : {dateDevis}</p>
                <p className="text-sm text-gray-500">Valide jusqu&apos;au : {dateValidite}</p>
              </div>
            </div>
          </div>

          {/* ── Section 2 : Destinataire ──────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Destinataire</h2>
            {demande?.enseignant ? (
              <div className="text-sm text-gray-700 space-y-1">
                <p className="font-semibold">{demande.enseignant.prenom} {demande.enseignant.nom}</p>
                {demande.enseignant.etablissementNom && (
                  <p className="font-medium text-gray-600">{demande.enseignant.etablissementNom}</p>
                )}
                {demande.enseignant.etablissementAdresse && (
                  <p className="text-gray-500">{demande.enseignant.etablissementAdresse}</p>
                )}
                {demande.enseignant.email && <p className="text-gray-500">{demande.enseignant.email}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Information non disponible</p>
            )}
          </div>

          {/* ── Section 3 : Objet ─────────────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Objet</h2>
            {sejour ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-900">
                  Séjour scolaire — {sejour.titre}
                </p>
              </div>
            ) : demande ? (
              <p className="text-sm font-semibold text-gray-900">
                {demande.titre} — {demande.villeHebergement} — {demande.nombreEleves} élèves
              </p>
            ) : (
              <p className="text-sm text-gray-400">Chargement...</p>
            )}
          </div>

          {/* ── Section 4 : Lignes de devis ───────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Détail de la prestation</h2>

            {/* Header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 border-b border-gray-200 mb-2">
              <div className="col-span-4">Description</div>
              <div className="col-span-2 text-right">Quantité</div>
              <div className="col-span-2 text-right">Prix unit. HT</div>
              <div className="col-span-1 text-right">TVA %</div>
              <div className="col-span-2 text-right">Total HT</div>
              <div className="col-span-1" />
            </div>

            {/* Lines */}
            {lignes.map((l) => {
              const qte = parseFloat(l.quantite) || 0;
              const pu = parseFloat(l.prixUnitaire) || 0;
              const ht = qte * pu;
              return (
                <div key={l.key} className="grid grid-cols-12 gap-2 items-center py-2 border-b border-gray-50 group">
                  <div className="col-span-12 sm:col-span-4">
                    <input value={l.description} onChange={(e) => updateLigne(l.key, 'description', e.target.value)}
                      placeholder="Description" className="w-full text-sm border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 px-0 py-1 bg-transparent" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input value={l.quantite} onChange={(e) => updateLigne(l.key, 'quantite', e.target.value)}
                      placeholder="0" type="number" step="any" className="w-full text-sm text-right border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 px-0 py-1 bg-transparent" />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <input value={l.prixUnitaire} onChange={(e) => updateLigne(l.key, 'prixUnitaire', e.target.value)}
                      placeholder="0.00" type="number" step="0.01" className="w-full text-sm text-right border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 px-0 py-1 bg-transparent" />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <input value={l.tva} onChange={(e) => updateLigne(l.key, 'tva', e.target.value)}
                      placeholder="0" type="number" step="0.1" className="w-full text-sm text-right border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 px-0 py-1 bg-transparent" />
                  </div>
                  <div className="col-span-1 sm:col-span-2 text-right text-sm font-medium text-gray-900">
                    {fmt(ht)} €
                  </div>
                  <div className="col-span-1 text-right">
                    {lignes.length > 1 && (
                      <button onClick={() => removeLigne(l.key)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <button onClick={addLigne}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)] font-medium">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Ajouter une ligne
            </button>
          </div>

          {/* ── Section 5 : Totaux ────────────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row gap-8">
              {/* TVA selector */}
              <div className="flex-1 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Taux de TVA global</label>
                  <div className="flex gap-2">
                    {TVA_OPTIONS.map((opt) => (
                      <button key={opt.value} onClick={() => setTauxTva(opt.value)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          tauxTva === opt.value
                            ? 'bg-[var(--color-primary)] text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Acompte demandé : {pourcentageAcompte}%
                  </label>
                  <input type="range" min="10" max="50" step="5" value={pourcentageAcompte}
                    onChange={(e) => setPourcentageAcompte(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>10%</span><span>50%</span>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="sm:w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sous-total HT</span>
                  <span className="font-medium text-gray-900">{fmt(calculs.montantHT)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">TVA ({tauxTva}%)</span>
                  <span className="font-medium text-gray-900">{fmt(calculs.montantTVA)} €</span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2">
                  <span className="text-gray-900">Total TTC</span>
                  <span className="text-[var(--color-primary)]">{fmt(calculs.montantTTC)} €</span>
                </div>
                <div className="border-t border-dashed border-gray-200 pt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Acompte ({pourcentageAcompte}%)</span>
                    <span className="font-semibold text-orange-600">{fmt(calculs.montantAcompte)} €</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Reste à payer</span>
                    <span className="font-medium text-gray-700">{fmt(calculs.resteAPayer)} €</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 6 : Conditions ────────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Conditions</h2>
            <textarea value={conditionsAnnulation} onChange={(e) => setConditionsAnnulation(e.target.value)}
              rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-border-strong)] bg-white" />
            <p className="mt-2 text-xs text-gray-400">Validité du devis : {validiteJours} jours (jusqu&apos;au {dateValidite})</p>
          </div>

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className="px-8 py-6 flex flex-col sm:flex-row gap-3 justify-end">
            <Link href="/dashboard/venue/devis"
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-center">
              Annuler
            </Link>
            <button onClick={handleSubmit}
              disabled={sending || calculs.montantHT <= 0}
              className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {sending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Modification en cours...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                  Enregistrer les modifications
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
