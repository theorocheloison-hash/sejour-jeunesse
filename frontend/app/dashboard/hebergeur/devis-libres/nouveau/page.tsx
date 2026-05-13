'use client';

import { Suspense, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { createDevisLibre, envoyerDevisLibre } from '@/src/lib/devis-libres';
import type { CreateDevisLibreDto } from '@/src/lib/devis-libres';
import { getMesClients } from '@/src/lib/clients';
import type { Client } from '@/src/lib/clients';
import { getCatalogue } from '@/src/lib/centre';
import type { ProduitCatalogue } from '@/src/lib/centre';

// ─── Types ──────────────────────────────────────────────────────────────────

type LigneForm = {
  key: string;
  description: string;
  quantite: string;
  prixUnitaire: string;
  tva: string;
};

let keyCounter = 0;
function newKey() { return `l-${++keyCounter}`; }

function makeLigneForm(opts?: { description?: string; quantite?: string; prixUnitaire?: string; tva?: string }): LigneForm {
  return {
    key: newKey(),
    description: opts?.description ?? '',
    quantite: opts?.quantite ?? '',
    prixUnitaire: opts?.prixUnitaire ?? '',
    tva: opts?.tva ?? '0',
  };
}

const CONDITIONS_DEFAULT =
  "Annulation jusqu'à 6 mois avant le séjour : remboursement intégral de l'acompte. " +
  "Entre 6 et 3 mois : 50% retenu. Moins de 3 mois : intégralité due.";

// ─── Page (Suspense wrapper) ────────────────────────────────────────────────

export default function NouveauDevisLibrePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    }>
      <NouveauDevisLibreContent />
    </Suspense>
  );
}

// ─── Content ────────────────────────────────────────────────────────────────

function NouveauDevisLibreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get('clientId') ?? '';
  const initialDateDebut = searchParams.get('dateDebut') ?? '';
  const initialDateFin = searchParams.get('dateFin') ?? '';
  const { user, isLoading } = useAuth();

  // Client
  const [nomClient, setNomClient] = useState('');
  const [prenomClient, setPrenomClient] = useState('');
  const [emailClient, setEmailClient] = useState('');
  const [telClient, setTelClient] = useState('');
  const [adresseClient, setAdresseClient] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Recherche client
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSuggestions, setClientSuggestions] = useState<Client[]>([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Événement
  const [typeEvenement, setTypeEvenement] = useState('');
  const [dateDebut, setDateDebut] = useState(initialDateDebut);
  const [dateFin, setDateFin] = useState(initialDateFin);
  const [description, setDescription] = useState('');

  // Lignes
  const [lignes, setLignes] = useState<LigneForm[]>([makeLigneForm()]);

  // Catalogue
  const [catalogue, setCatalogue] = useState<ProduitCatalogue[]>([]);
  const [showCatalogueDropdown, setShowCatalogueDropdown] = useState(false);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [activeDescriptionKey, setActiveDescriptionKey] = useState<string | null>(null);
  const [descriptionSearch, setDescriptionSearch] = useState('');

  // Acompte / conditions / notes
  const [pourcentageAcompte, setPourcentageAcompte] = useState(30);
  const [conditionsAnnulation, setConditionsAnnulation] = useState(CONDITIONS_DEFAULT);
  const [notesInternes, setNotesInternes] = useState('');

  // Submit state
  const [sending, setSending] = useState<null | 'brouillon' | 'envoi'>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // ── Auth guard ──
  useEffect(() => {
    if (!isLoading && (!user || user.role !== 'HEBERGEUR')) router.replace('/login');
  }, [isLoading, user, router]);

  // ── Load clients + catalogue ──
  useEffect(() => {
    if (!user) return;
    Promise.all([
      getMesClients().catch(() => [] as Client[]),
      getCatalogue().catch(() => [] as ProduitCatalogue[]),
    ]).then(([cs, cat]) => {
      setClients(cs);
      setCatalogue(cat);
      // Pré-remplissage depuis clientId
      if (initialClientId) {
        const c = cs.find(x => x.id === initialClientId);
        if (c) {
          setSelectedClientId(c.id);
          setNomClient(c.nom);
          setEmailClient(c.email ?? '');
          setTelClient(c.telephone ?? '');
          setAdresseClient(c.adresse ?? '');
        }
      }
    }).finally(() => setLoadingInitial(false));
  }, [user, initialClientId]);

  // ── Recherche client avec debounce 300ms ──
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (nomClient.trim().length < 2) {
        setClientSuggestions([]);
        return;
      }
      const q = nomClient.toLowerCase().trim();
      setClientSuggestions(clients.filter(c => c.nom.toLowerCase().includes(q)).slice(0, 8));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nomClient, clients]);

  // ── Close catalogue dropdown on outside click ──
  useEffect(() => {
    if (!showCatalogueDropdown) return;
    const handler = () => { setShowCatalogueDropdown(false); setCatalogueSearch(''); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showCatalogueDropdown]);

  // ── Calculs ──
  const calculs = useMemo(() => {
    let montantHT = 0;
    let montantTVA = 0;
    lignes.forEach((l) => {
      const qte = parseFloat(l.quantite) || 0;
      const pu = parseFloat(l.prixUnitaire) || 0;
      const tvaLigne = parseFloat(l.tva) || 0;
      const ht = qte * pu;
      const tva = ht * (tvaLigne / 100);
      montantHT += ht;
      montantTVA += tva;
    });
    const montantTTC = montantHT + montantTVA;
    const montantAcompte = montantTTC * (pourcentageAcompte / 100);
    const resteAPayer = montantTTC - montantAcompte;
    return { montantHT, montantTVA, montantTTC, montantAcompte, resteAPayer };
  }, [lignes, pourcentageAcompte]);

  // ── Handlers lignes ──
  const updateLigne = useCallback((key: string, field: keyof LigneForm, value: string) => {
    setLignes((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }, []);

  const removeLigne = useCallback((key: string) => {
    setLignes((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const selectProduitForLigne = useCallback((key: string, produit: ProduitCatalogue) => {
    setLignes((prev) => prev.map((l) =>
      l.key === key
        ? { ...l, description: produit.nom, prixUnitaire: String(produit.prixUnitaireHT), tva: String(produit.tva) }
        : l
    ));
    setActiveDescriptionKey(null);
    setDescriptionSearch('');
  }, []);

  // ── Sélection d'un client suggéré ──
  const handleSelectClient = (c: Client) => {
    setSelectedClientId(c.id);
    setNomClient(c.nom);
    setEmailClient(c.email ?? '');
    setTelClient(c.telephone ?? '');
    setAdresseClient(c.adresse ?? '');
    setShowClientDropdown(false);
    setClientSuggestions([]);
  };

  // ── Construction DTO ──
  const buildDto = (): CreateDevisLibreDto => {
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

    return {
      nomClient: nomClient.trim(),
      prenomClient: prenomClient.trim() || undefined,
      emailClient: emailClient.trim() || undefined,
      telClient: telClient.trim() || undefined,
      adresseClient: adresseClient.trim() || undefined,
      typeEvenement: typeEvenement.trim() || undefined,
      dateDebut,
      dateFin,
      description: description.trim() || undefined,
      conditionsAnnulation: conditionsAnnulation.trim() || undefined,
      notesInternes: notesInternes.trim() || undefined,
      clientId: selectedClientId ?? undefined,
      montantHT: calculs.montantHT,
      montantTVA: calculs.montantTVA,
      montantTTC: calculs.montantTTC,
      pourcentageAcompte,
      montantAcompte: calculs.montantAcompte,
      lignes: lignesData,
    };
  };

  // ── Save brouillon ──
  const handleSaveBrouillon = async () => {
    if (!nomClient.trim() || !dateDebut || !dateFin) {
      setError('Nom du client et dates obligatoires.');
      return;
    }
    setSending('brouillon');
    setError(null);
    try {
      const devis = await createDevisLibre(buildDto());
      router.push(`/dashboard/hebergeur/devis-libres/${devis.id}`);
    } catch {
      setError("Erreur lors de l'enregistrement du devis.");
      setSending(null);
    }
  };

  // ── Save + envoyer ──
  const handleSaveEnvoyer = async () => {
    if (!nomClient.trim() || !dateDebut || !dateFin) {
      setError('Nom du client et dates obligatoires.');
      return;
    }
    if (!emailClient.trim()) {
      setError("Email client requis pour l'envoi.");
      return;
    }
    setSending('envoi');
    setError(null);
    try {
      const devis = await createDevisLibre(buildDto());
      await envoyerDevisLibre(devis.id);
      router.push(`/dashboard/hebergeur/devis-libres/${devis.id}`);
    } catch {
      setError("Erreur lors de l'envoi du devis.");
      setSending(null);
    }
  };

  // ── Render ──
  if (isLoading || !user || loadingInitial) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    );
  }

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const canEnvoyer = nomClient.trim() && dateDebut && dateFin && emailClient.trim() && calculs.montantHT > 0;
  const canBrouillon = nomClient.trim() && dateDebut && dateFin;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <Link href="/dashboard/hebergeur" className="text-sm text-[var(--color-primary)] hover:underline font-medium">
              &larr; Tableau de bord
            </Link>
            <span className="text-sm font-semibold text-gray-700">Nouveau devis événement</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* ── Section 1 : Client ──────────────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Client</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nom *</label>
                <input
                  value={nomClient}
                  onChange={(e) => {
                    setNomClient(e.target.value);
                    setSelectedClientId(null);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  onBlur={() => setTimeout(() => setShowClientDropdown(false), 200)}
                  placeholder="Nom du client"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
                {showClientDropdown && clientSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-white rounded-xl border border-gray-200 shadow-lg max-h-56 overflow-y-auto">
                    {clientSuggestions.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectClient(c)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0"
                      >
                        <p className="font-medium text-gray-900 truncate">{c.nom}</p>
                        {(c.email || c.telephone) && (
                          <p className="text-xs text-gray-500 truncate">
                            {[c.email, c.telephone].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {selectedClientId && (
                  <p className="mt-1 text-xs text-[var(--color-success)]">✓ Client existant lié</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Prénom</label>
                <input
                  value={prenomClient}
                  onChange={(e) => setPrenomClient(e.target.value)}
                  placeholder="Prénom"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={emailClient}
                  onChange={(e) => setEmailClient(e.target.value)}
                  placeholder="email@exemple.fr"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
                <input
                  value={telClient}
                  onChange={(e) => setTelClient(e.target.value)}
                  placeholder="06 12 34 56 78"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
                <input
                  value={adresseClient}
                  onChange={(e) => setAdresseClient(e.target.value)}
                  placeholder="Adresse complète"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
                />
              </div>
            </div>
          </div>

          {/* ── Section 2 : Événement ───────────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Événement</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Type d&apos;événement</label>
                <input
                  value={typeEvenement}
                  onChange={(e) => setTypeEvenement(e.target.value)}
                  placeholder="Mariage, Séminaire..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date début *</label>
                <input
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date fin *</label>
                <input
                  type="date"
                  value={dateFin}
                  onChange={(e) => setDateFin(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Description de l'événement"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
                />
              </div>
            </div>
          </div>

          {/* ── Section 3 : Lignes de prestation ────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Détail de la prestation</h2>

            {/* Header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide pb-2 border-b border-gray-200 mb-2">
              <div className="col-span-3">Description</div>
              <div className="col-span-2 text-right">Quantité</div>
              <div className="col-span-2 text-right">PU HT</div>
              <div className="col-span-1 text-right">TVA %</div>
              <div className="col-span-1 text-right">PU TTC</div>
              <div className="col-span-2 text-right">Total TTC</div>
              <div className="col-span-1" />
            </div>

            {/* Lines */}
            {lignes.map((l) => {
              const qte = parseFloat(l.quantite) || 0;
              const pu = parseFloat(l.prixUnitaire) || 0;
              const tvaRate = parseFloat(l.tva) || 0;
              const puTTC = pu * (1 + tvaRate / 100);
              const ht = qte * pu;
              const ttc = ht * (1 + tvaRate / 100);
              return (
                <div key={l.key} className="grid grid-cols-12 gap-2 items-center py-2 border-b border-gray-50 group">
                  <div className="col-span-12 sm:col-span-3 relative">
                    <input
                      value={activeDescriptionKey === l.key ? descriptionSearch : l.description}
                      onChange={(e) => {
                        setActiveDescriptionKey(l.key);
                        setDescriptionSearch(e.target.value);
                        updateLigne(l.key, 'description', e.target.value);
                      }}
                      onFocus={() => {
                        setActiveDescriptionKey(l.key);
                        setDescriptionSearch(l.description);
                      }}
                      onBlur={() => setTimeout(() => {
                        setActiveDescriptionKey(null);
                        setDescriptionSearch('');
                      }, 150)}
                      placeholder="Description"
                      className="w-full text-sm border-0 border-b border-transparent focus:border-indigo-400 focus:ring-0 px-0 py-1 bg-transparent"
                    />
                    {activeDescriptionKey === l.key && descriptionSearch.length >= 2 && (() => {
                      const results = catalogue.filter(p =>
                        p.nom.toLowerCase().includes(descriptionSearch.toLowerCase())
                      );
                      if (results.length === 0) return null;
                      return (
                        <div className="absolute left-0 top-8 z-50 w-64 bg-white rounded-xl border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                          {results.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectProduitForLigne(l.key, p)}
                              className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0"
                            >
                              <span className="text-sm text-gray-900 truncate">{p.nom}</span>
                              <span className="text-xs text-gray-500 shrink-0 ml-2">{p.prixUnitaireHT.toFixed(2)} € HT</span>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
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
                  <div className="col-span-1 sm:col-span-1 text-right text-sm text-gray-500">
                    {puTTC > 0 ? fmt(puTTC) : '—'} €
                  </div>
                  <div className="col-span-1 sm:col-span-2 text-right text-sm font-medium text-gray-900">
                    {fmt(ttc)} €
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

            <div className="mt-3 flex items-center gap-3">
              {/* Bouton catalogue */}
              {catalogue.length > 0 && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setShowCatalogueDropdown(v => !v); }}
                    className="flex items-center gap-2 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
                    </svg>
                    Depuis le catalogue
                  </button>
                  {showCatalogueDropdown && (
                    <div className="absolute left-0 top-8 z-30 w-80 bg-white rounded-xl border border-gray-200 shadow-lg flex flex-col" style={{ maxHeight: '400px' }}>
                      <div className="p-2 border-b border-gray-100 shrink-0" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 rounded-lg border border-gray-200 px-2.5 py-1.5 bg-gray-50">
                          <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                          </svg>
                          <input
                            type="text"
                            autoFocus
                            value={catalogueSearch}
                            onChange={e => setCatalogueSearch(e.target.value)}
                            placeholder="Rechercher un produit..."
                            className="flex-1 text-xs bg-transparent border-0 outline-none text-gray-700 placeholder-gray-400"
                          />
                          {catalogueSearch && (
                            <button type="button" onClick={() => setCatalogueSearch('')} className="text-gray-400 hover:text-gray-600">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="overflow-y-auto flex-1">
                        {(() => {
                          const q = catalogueSearch.toLowerCase().trim();
                          const labels: Record<string, string> = { HEBERGEMENT: 'Hébergement', REPAS: 'Repas', TRANSPORT: 'Transport', ACTIVITE: 'Activité', AUTRE: 'Autre' };
                          if (q) {
                            const results = catalogue.filter(p => p.nom.toLowerCase().includes(q));
                            if (results.length === 0) return (
                              <p className="px-3 py-4 text-xs text-center text-gray-400">Aucun produit trouvé</p>
                            );
                            return results.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  setLignes(prev => [...prev, makeLigneForm({
                                    description: p.nom,
                                    quantite: '1',
                                    prixUnitaire: String(p.prixUnitaireHT),
                                    tva: String(p.tva),
                                  })]);
                                  setShowCatalogueDropdown(false);
                                  setCatalogueSearch('');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm text-gray-900 truncate">{p.nom}</p>
                                  <p className="text-xs text-gray-400">{labels[p.type] ?? p.type}</p>
                                </div>
                                <span className="text-xs text-gray-500 shrink-0 ml-2">{p.prixUnitaireHT.toFixed(2)} € HT</span>
                              </button>
                            ));
                          }
                          return ['HEBERGEMENT', 'REPAS', 'TRANSPORT', 'ACTIVITE', 'AUTRE'].map(type => {
                            const items = catalogue.filter(p => p.type === type);
                            if (items.length === 0) return null;
                            return (
                              <div key={type}>
                                <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b border-gray-100 sticky top-0">{labels[type]}</p>
                                {items.map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => {
                                      setLignes(prev => [...prev, makeLigneForm({
                                        description: p.nom,
                                        quantite: '1',
                                        prixUnitaire: String(p.prixUnitaireHT),
                                        tva: String(p.tva),
                                      })]);
                                      setShowCatalogueDropdown(false);
                                      setCatalogueSearch('');
                                    }}
                                    className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0"
                                  >
                                    <span className="text-sm text-gray-900 truncate">{p.nom}</span>
                                    <span className="text-xs text-gray-500 shrink-0 ml-2">{p.prixUnitaireHT.toFixed(2)} € HT</span>
                                  </button>
                                ))}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bouton ligne vide */}
              <button
                type="button"
                onClick={() => setLignes(prev => [...prev, makeLigneForm()])}
                className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Ligne libre
              </button>
            </div>

            {/* Totaux + acompte */}
            <div className="mt-6 flex flex-col sm:flex-row gap-8">
              <div className="flex-1 space-y-4">
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

              <div className="sm:w-72 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Sous-total HT</span>
                  <span className="font-medium text-gray-900">{fmt(calculs.montantHT)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">TVA</span>
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

          {/* ── Section 4 : Conditions ──────────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Conditions d&apos;annulation</h2>
            <textarea
              value={conditionsAnnulation}
              onChange={(e) => setConditionsAnnulation(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] bg-white"
            />
          </div>

          {/* ── Section 5 : Notes internes ──────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Notes internes</h2>
            <p className="text-xs text-gray-400 mb-3">Non visibles par le client.</p>
            <textarea
              value={notesInternes}
              onChange={(e) => setNotesInternes(e.target.value)}
              rows={2}
              placeholder="Notes internes (rappels, négociations, etc.)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>

          {/* ── Actions ─────────────────────────────────────────────────────── */}
          <div className="px-8 py-6 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              type="button"
              onClick={() => router.push('/dashboard/hebergeur')}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveBrouillon}
              disabled={sending !== null || !canBrouillon}
              className="rounded-lg border border-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending === 'brouillon' ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer en brouillon'
              )}
            </button>
            <button
              type="button"
              onClick={handleSaveEnvoyer}
              disabled={sending !== null || !canEnvoyer}
              title={!emailClient.trim() ? "Email client requis pour l'envoi" : undefined}
              className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending === 'envoi' ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Envoi en cours...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Enregistrer et envoyer
                </>
              )}
            </button>
          </div>
          {!emailClient.trim() && (
            <p className="px-8 pb-6 -mt-2 text-xs text-gray-400 text-right">
              Email client requis pour l&apos;envoi du devis au client.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
