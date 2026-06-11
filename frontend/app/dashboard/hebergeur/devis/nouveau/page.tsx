'use client';

import { Fragment, Suspense, useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { createDevis, createDirectDevis, getNextNumeroDevis, getDemandeInfo } from '@/src/lib/devis';
import type { DemandeInfo, LigneDevis } from '@/src/lib/devis';
import { getCatalogue, getMonProfil } from '@/src/lib/centre';
import type { ProduitCatalogue } from '@/src/lib/centre';
import { getSejourCollabInfo } from '@/src/lib/collaboration';
import { formatParticipants } from '@/src/lib/utils';

const round2 = (n: number) => Math.round(n * 100) / 100;

// ─── Constants ──────────────────────────────────────────────────────────────

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
  return { key: newKey(), description: opts?.description ?? '', quantite: opts?.quantite ?? '', prixUnitaire: opts?.prixUnitaire ?? '', tva: opts?.tva ?? '0' };
}

// ─── Page (Suspense wrapper) ────────────────────────────────────────────────

export default function NouveauDevisPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
      </div>
    }>
      <NouveauDevisContent />
    </Suspense>
  );
}

// ─── Content ────────────────────────────────────────────────────────────────

function NouveauDevisContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const demandeId = searchParams.get('demandeId') ?? '';
  const sejourDirectId = searchParams.get('sejourDirectId') ?? '';
  const isDirect = !!sejourDirectId;
  const { user, isLoading } = useAuth();

  // Data
  const [info, setInfo] = useState<DemandeInfo | null>(null);
  const [numeroDevis, setNumeroDevis] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Company info
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [adresseEntreprise, setAdresseEntreprise] = useState('');
  const [siretEntreprise, setSiretEntreprise] = useState('');
  const [emailEntreprise, setEmailEntreprise] = useState('');
  const [telEntreprise, setTelEntreprise] = useState('');

  // Lines
  const [lignes, setLignes] = useState<LigneForm[]>([makeLigneForm()]);

  // Catalogue
  const [catalogue, setCatalogue] = useState<ProduitCatalogue[]>([]);
  const [showCatalogueDropdown, setShowCatalogueDropdown] = useState(false);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [activeDescriptionKey, setActiveDescriptionKey] = useState<string | null>(null);
  const [descriptionSearch, setDescriptionSearch] = useState('');

  // Acompte
  const [pourcentageAcompte, setPourcentageAcompte] = useState(30);

  // Conditions
  const [conditionsAnnulation, setConditionsAnnulation] = useState(
    'Annulation gratuite jusqu\'à 30 jours avant le début du séjour. ' +
    'Entre 30 et 15 jours : 50% du montant TTC. ' +
    'Moins de 15 jours : 100% du montant TTC.'
  );
  const [validiteJours] = useState(30);

  // Submit state
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);

  // Données séjour DIRECT (pour afficher Destinataire + Objet)
  const [directSejour, setDirectSejour] = useState<{
    titre: string; dateDebut: string | null; dateFin: string | null; placesTotales: number;
    nombreAccompagnateurs?: number | null;
    clientNom: string | null; clientEmail: string | null; clientOrganisation: string | null;
    lieu: string;
  } | null>(null);


  // ── Load data ──
  useEffect(() => {
    if (!user) return;
    // Mode DIRECT : pas de demandeId, on charge le centre + numéro
    if (isDirect) {
      Promise.all([
        getNextNumeroDevis(),
        getCatalogue().catch(() => [] as ProduitCatalogue[]),
        getMonProfil(),
      ])
        .then(([numData, cat, centre]) => {
          setNumeroDevis(numData.numero);
          setCatalogue(cat);
          setNomEntreprise(centre.nom ?? '');
          setAdresseEntreprise(`${centre.adresse ?? ''}, ${centre.codePostal ?? ''} ${centre.ville ?? ''}`);
          setSiretEntreprise(centre.siret ?? '');
          setEmailEntreprise(centre.email ?? '');
          setTelEntreprise(centre.telephone ?? '');
          if (centre.conditionsAnnulation) {
            setConditionsAnnulation(centre.conditionsAnnulation);
          }
        })
        .catch(() => setLoadError('Impossible de charger les informations du centre.'));
      // Charger aussi les données du séjour pour Destinataire/Objet
      getSejourCollabInfo(sejourDirectId)
        .then(s => setDirectSejour({
          titre: s.titre,
          dateDebut: s.dateDebut,
          dateFin: s.dateFin,
          placesTotales: s.placesTotales,
          nombreAccompagnateurs: s.nombreAccompagnateurs,
          clientNom: s.clientNom ?? null,
          clientEmail: s.clientEmail ?? null,
          clientOrganisation: s.clientOrganisation ?? null,
          lieu: s.lieu,
        }))
        .catch(() => {});
      return;
    }
    // Mode collaboratif : demandeId obligatoire
    if (!demandeId) return;
    Promise.all([
      getDemandeInfo(demandeId),
      getNextNumeroDevis(),
      getCatalogue().catch(() => [] as ProduitCatalogue[]),
    ])
      .then(([infoData, numData, cat]) => {
        setInfo(infoData);
        setNumeroDevis(numData.numero);
        setCatalogue(cat);
        setNomEntreprise(infoData.centre.nom);
        setAdresseEntreprise(`${infoData.centre.adresse}, ${infoData.centre.codePostal} ${infoData.centre.ville}`);
        setSiretEntreprise(infoData.centre.siret ?? '');
        setEmailEntreprise(infoData.centre.email ?? '');
        setTelEntreprise(infoData.centre.telephone ?? '');
        setLignes([makeLigneForm({ quantite: String(infoData.demande.nombreEleves ?? 1) })]);
        if (infoData.centre.conditionsAnnulation) {
          setConditionsAnnulation(infoData.centre.conditionsAnnulation);
        }
      })
      .catch(() => setLoadError('Impossible de charger les informations de la demande.'));
  }, [user, demandeId, isDirect, sejourDirectId]);

  // ── Close catalogue dropdown on outside click ──
  useEffect(() => {
    if (!showCatalogueDropdown) return;
    const handler = () => { setShowCatalogueDropdown(false); setCatalogueSearch(''); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showCatalogueDropdown]);

  // ── Calculations ──
  const calculs = useMemo(() => {
    let montantHT = 0;
    let montantTVA = 0;
    let montantTTC = 0;
    lignes.forEach((l) => {
      const qte = parseFloat(l.quantite) || 0;
      const puTTC = parseFloat(l.prixUnitaire) || 0;
      const tvaLigne = parseFloat(l.tva) || 0;
      const puHT = round2(puTTC / (1 + tvaLigne / 100));
      const ligneHT = round2(puHT * qte);
      const ligneTTC = round2(puTTC * qte);
      montantHT += ligneHT;
      montantTTC += ligneTTC;
    });
    montantTVA = round2(montantTTC - montantHT);
    const montantAcompte = round2(montantTTC * (pourcentageAcompte / 100));
    const resteAPayer = round2(montantTTC - montantAcompte);
    return { montantHT, montantTVA, montantTTC, montantAcompte, resteAPayer };
  }, [lignes, pourcentageAcompte]);

  // ── Line handlers ──
  const updateLigne = useCallback((key: string, field: keyof LigneForm, value: string) => {
    setLignes((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  }, []);

  const removeLigne = useCallback((key: string) => {
    setLignes((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const insertLigneAt = useCallback((afterIndex: number) => {
    setLignes((prev) => [
      ...prev.slice(0, afterIndex + 1),
      makeLigneForm(),
      ...prev.slice(afterIndex + 1),
    ]);
  }, []);

  const selectProduitForLigne = useCallback((key: string, produit: ProduitCatalogue) => {
    setLignes((prev) => prev.map((l) =>
      l.key === key
        ? { ...l, description: produit.nom, prixUnitaire: String(produit.prixUnitaireTTC ?? round2(produit.prixUnitaireHT * (1 + produit.tva / 100))), tva: String(produit.tva) }
        : l
    ));
    setActiveDescriptionKey(null);
    setDescriptionSearch('');
  }, []);

  // ── Submit ──
  const handleSubmit = async () => {
    setSending(true);

    const lignesData = lignes
      .filter((l) => l.description.trim().length > 0)
      .map((l) => {
        const qte = parseFloat(l.quantite) || 0;
        const puTTC = parseFloat(l.prixUnitaire) || 0;
        const tvaL = parseFloat(l.tva) || 0;
        const puHT = round2(puTTC / (1 + tvaL / 100));
        const totalTTC = round2(puTTC * qte);
        const totalHT = round2(puHT * qte);
        return { description: l.description, quantite: qte, prixUnitaire: puHT, tva: tvaL, totalHT, totalTTC };
      });

    // Mode DIRECT : appeler createDirectDevis
    if (isDirect && sejourDirectId) {
      const qteFirst = parseFloat(lignes[0]?.quantite) || 1;
      try {
        await createDirectDevis({
          sejourDirectId,
          montantTotal: calculs.montantTTC.toFixed(2),
          montantParEleve: (calculs.montantTTC / qteFirst).toFixed(2),
          conditionsAnnulation,
          nomEntreprise,
          adresseEntreprise,
          siretEntreprise: siretEntreprise || undefined,
          emailEntreprise: emailEntreprise || undefined,
          telEntreprise: telEntreprise || undefined,
          tauxTva: calculs.montantHT > 0 ? round2((calculs.montantTVA / calculs.montantHT) * 100) : 0,
          montantHT: calculs.montantHT,
          montantTVA: calculs.montantTVA,
          montantTTC: calculs.montantTTC,
          pourcentageAcompte,
          montantAcompte: calculs.montantAcompte,
          numeroDevis: numeroDevis || undefined,
          lignes: lignesData,
        });
        setSuccess(true);
        setTimeout(() => router.push(`/dashboard/sejour/${sejourDirectId}`), 1500);
      } catch (err: any) {
        setLoadError(err?.response?.data?.message ?? 'Erreur lors de la création du devis');
      } finally {
        setSending(false);
      }
      return;
    }

    if (!demandeId || !info) {
      setSending(false);
      return;
    }

    const nombreEleves = info.demande.nombreEleves || 1;

    try {
      await createDevis({
        demandeId,
        montantTotal: calculs.montantTTC.toFixed(2),
        montantParEleve: (calculs.montantTTC / nombreEleves).toFixed(2),
        description: `${info.demande.sejour?.titre ?? info.demande.titre} — ${info.demande.villeHebergement}`,
        conditionsAnnulation,
        nomEntreprise,
        adresseEntreprise,
        siretEntreprise: siretEntreprise || undefined,
        emailEntreprise: emailEntreprise || undefined,
        telEntreprise: telEntreprise || undefined,
        montantHT: calculs.montantHT,
        montantTVA: calculs.montantTVA,
        montantTTC: calculs.montantTTC,
        pourcentageAcompte,
        montantAcompte: calculs.montantAcompte,
        numeroDevis,
        typeDevis: 'PLATEFORME',
        lignes: lignesData,
      });
      setSuccess(true);
    } catch {
      setLoadError('Erreur lors de l\'envoi du devis.');
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

  if (!demandeId && !isDirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-sm text-red-600">Paramètre demandeId ou sejourDirectId manquant.</div>
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
          <h2 className="text-lg font-bold text-gray-900 mb-2">{isDirect ? 'Devis créé !' : 'Devis envoyé !'}</h2>
          <p className="text-sm text-gray-500 mb-6">
            {isDirect
              ? `Le devis ${numeroDevis} a été créé. Vous pouvez maintenant l'envoyer au client depuis la page du séjour.`
              : `Votre devis ${numeroDevis} a été transmis à l'enseignant.`}
          </p>
          <Link
            href={isDirect ? `/dashboard/sejour/${sejourDirectId}` : '/dashboard/hebergeur/devis'}
            className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary)] transition-colors"
          >
            {isDirect ? 'Retour au séjour' : 'Voir mes devis'}
          </Link>
        </div>
      </div>
    );
  }

  const demande = info?.demande;
  const centre = info?.centre;
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
              <Link
                href={isDirect ? `/dashboard/sejour/${sejourDirectId}` : '/dashboard/hebergeur/demandes'}
                className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)] font-medium"
              >
                {isDirect ? '← Retour au séjour' : '← Retour aux demandes'}
              </Link>
            </div>
            <span className="text-sm font-semibold text-gray-700">Créateur de devis</span>
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
            {isDirect ? (
              directSejour ? (
                <div className="text-sm text-gray-700 space-y-1">
                  {directSejour.clientNom && <p className="font-semibold">{directSejour.clientNom}</p>}
                  {directSejour.clientOrganisation && <p className="font-medium text-gray-600">{directSejour.clientOrganisation}</p>}
                  {directSejour.clientEmail && <p className="text-gray-500">{directSejour.clientEmail}</p>}
                  {!directSejour.clientNom && !directSejour.clientOrganisation && (
                    <p className="text-gray-400 italic">Client non renseigné</p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Chargement...</p>
              )
            ) : demande ? (
              <div className="text-sm text-gray-700 space-y-1">
                {demande.enseignant && (
                  <p className="font-semibold">{demande.enseignant.prenom} {demande.enseignant.nom}</p>
                )}
                {demande.enseignant?.memberships?.[0]?.organisation.nom && (
                  <p className="font-medium text-gray-600">{demande.enseignant.memberships[0].organisation.nom}</p>
                )}
                {demande.enseignant?.memberships?.[0]?.organisation.ville && (
                  <p className="text-gray-500">{demande.enseignant.memberships[0].organisation.ville}</p>
                )}
                {demande.enseignant?.email && <p className="text-gray-500">{demande.enseignant.email}</p>}
                {demande.enseignant?.telephone && <p className="text-gray-500">Pers. : {demande.enseignant.telephone}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Chargement...</p>
            )}
          </div>

          {/* ── Section 3 : Objet ─────────────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Objet</h2>
            {isDirect ? (
              directSejour ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {directSejour.titre} — {directSejour.lieu}{directSejour.dateDebut && directSejour.dateFin
                      ? ` — du ${new Date(directSejour.dateDebut).toLocaleDateString('fr-FR')} au ${new Date(directSejour.dateFin).toLocaleDateString('fr-FR')}`
                      : ' — Dates à définir'}
                  </p>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{formatParticipants(directSejour.placesTotales, directSejour.nombreAccompagnateurs)}</span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Chargement...</p>
              )
            ) : sejour ? (
              <div className="space-y-1">
                <p className="text-sm font-semibold text-gray-900">
                  Séjour — {sejour.lieu} — du {new Date(sejour.dateDebut).toLocaleDateString('fr-FR')} au {new Date(sejour.dateFin).toLocaleDateString('fr-FR')}
                </p>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>{formatParticipants(sejour.placesTotales, sejour.nombreAccompagnateurs)}</span>
                  {sejour.niveauClasse && <span>Niveau : {sejour.niveauClasse}</span>}
                </div>
              </div>
            ) : demande ? (
              <p className="text-sm font-semibold text-gray-900">
                {demande.titre} — {demande.villeHebergement} — {demande.nombreEleves} participants
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
              <div className="col-span-3">Description</div>
              <div className="col-span-2 text-right">Quantité</div>
              <div className="col-span-2 text-right">PU TTC</div>
              <div className="col-span-1 text-right">TVA %</div>
              <div className="col-span-1 text-right">PU HT</div>
              <div className="col-span-2 text-right">Total TTC</div>
              <div className="col-span-1" />
            </div>

            {/* Lines */}
            {lignes.map((l, idx) => {
              const qte = parseFloat(l.quantite) || 0;
              const puTTC = parseFloat(l.prixUnitaire) || 0;
              const tvaRate = parseFloat(l.tva) || 0;
              const puHT = round2(puTTC / (1 + tvaRate / 100));
              const totalTTC = round2(puTTC * qte);
              const totalHT = round2(puHT * qte);
              return (
                <Fragment key={l.key}>
                <div className="grid grid-cols-12 gap-2 items-center py-2 border-b border-gray-50 group">
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
                        <div className="absolute left-0 top-8 z-50 w-96 bg-white rounded-xl border border-gray-200 shadow-lg max-h-48 overflow-y-auto">
                          {results.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => selectProduitForLigne(l.key, p)}
                              className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0"
                            >
                              <span className="text-sm text-gray-900 line-clamp-2">{p.nom}</span>
                              <span className="text-xs text-gray-500 shrink-0 ml-2">{((p.prixUnitaireTTC ?? round2(p.prixUnitaireHT * (1 + p.tva / 100)))).toFixed(2)} € TTC</span>
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
                    {puHT > 0 ? fmt(puHT) : '—'} €
                  </div>
                  <div className="col-span-1 sm:col-span-2 text-right text-sm font-medium text-gray-900">
                    {fmt(totalTTC)} €
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

                {/* Bouton d'insertion entre les lignes — uniquement entre 2 lignes, pas après la dernière */}
                {idx < lignes.length - 1 && (
                  <div className="group/ins relative flex items-center justify-center h-0 overflow-visible">
                    <button
                      type="button"
                      onClick={() => insertLigneAt(idx)}
                      className="absolute opacity-0 group-hover/ins:opacity-100 transition-opacity z-10 flex items-center gap-1 rounded-full bg-[var(--color-primary)] text-white px-2.5 py-0.5 text-[10px] font-semibold shadow hover:scale-105 transition-transform whitespace-nowrap"
                      title="Insérer une ligne à cet endroit"
                    >
                      + insérer ici
                    </button>
                    {/* Ligne de séparation visible au survol */}
                    <div className="absolute inset-x-0 h-px bg-[var(--color-primary)] opacity-0 group-hover/ins:opacity-30 transition-opacity" />
                  </div>
                )}
                </Fragment>
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
                    <div className="absolute left-0 top-8 z-30 w-96 bg-white rounded-xl border border-gray-200 shadow-lg flex flex-col" style={{ maxHeight: '400px' }}>
                      {/* Champ de recherche fixe en haut */}
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
                      {/* Liste scrollable */}
                      <div className="overflow-y-auto flex-1">
                        {(() => {
                          const q = catalogueSearch.toLowerCase().trim();
                          const labels: Record<string, string> = { HEBERGEMENT: 'Hébergement', REPAS: 'Repas', TRANSPORT: 'Transport', ACTIVITE: 'Activité', AUTRE: 'Autre' };
                          // Mode recherche : affichage à plat sans catégories
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
                                    quantite: String(info?.demande.nombreEleves ?? 1),
                                    prixUnitaire: String(p.prixUnitaireTTC ?? round2(p.prixUnitaireHT * (1 + p.tva / 100))),
                                    tva: String(p.tva),
                                  })]);
                                  setShowCatalogueDropdown(false);
                                  setCatalogueSearch('');
                                }}
                                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0"
                              >
                                <div className="min-w-0">
                                  <p className="text-sm text-gray-900 line-clamp-2">{p.nom}</p>
                                  <p className="text-xs text-gray-400">{labels[p.type] ?? p.type}</p>
                                </div>
                                <span className="text-xs text-gray-500 shrink-0 ml-2">{((p.prixUnitaireTTC ?? round2(p.prixUnitaireHT * (1 + p.tva / 100)))).toFixed(2)} € TTC</span>
                              </button>
                            ));
                          }
                          // Mode normal : affichage par catégorie
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
                                        quantite: String(info?.demande.nombreEleves ?? 1),
                                        prixUnitaire: String(p.prixUnitaireTTC ?? round2(p.prixUnitaireHT * (1 + p.tva / 100))),
                                        tva: String(p.tva),
                                      })]);
                                      setShowCatalogueDropdown(false);
                                      setCatalogueSearch('');
                                    }}
                                    className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0"
                                  >
                                    <span className="text-sm text-gray-900 line-clamp-2">{p.nom}</span>
                                    <span className="text-xs text-gray-500 shrink-0 ml-2">{((p.prixUnitaireTTC ?? round2(p.prixUnitaireHT * (1 + p.tva / 100)))).toFixed(2)} € TTC</span>
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
          </div>

          {/* ── Section 5 : Totaux ────────────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row gap-8">
              {/* Acompte */}
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

              {/* Summary */}
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

          {/* ── Section 6 : Conditions ────────────────────────────────────── */}
          <div className="px-8 py-6 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Conditions</h2>
            <textarea value={conditionsAnnulation} onChange={(e) => setConditionsAnnulation(e.target.value)}
              rows={3} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-[var(--color-border-strong)] bg-white" />
            <p className="mt-2 text-xs text-gray-400">Validité du devis : {validiteJours} jours (jusqu&apos;au {dateValidite})</p>
          </div>

          {/* ── Actions ───────────────────────────────────────────────────── */}
          <div className="px-8 py-6 flex flex-col sm:flex-row gap-3 justify-end">
            <Link
              href={isDirect ? `/dashboard/sejour/${sejourDirectId}` : '/dashboard/hebergeur/demandes'}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors text-center"
            >
              Annuler
            </Link>
            <button onClick={handleSubmit}
              disabled={sending || calculs.montantHT <= 0}
              className="rounded-lg bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {sending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {isDirect ? 'Enregistrement...' : 'Envoi en cours...'}
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  {isDirect ? 'Enregistrer le devis' : 'Envoyer le devis'}
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
