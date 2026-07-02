'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { createDevis, createDirectDevis, getNextNumeroDevis, getDemandeInfo } from '@/src/lib/devis';
import type { DemandeInfo } from '@/src/lib/devis';
import { getCatalogue, getMonProfil } from '@/src/lib/centre';
import type { ProduitCatalogue } from '@/src/lib/centre';
import { getSejourCollabInfo } from '@/src/lib/collaboration';
import { formatParticipants } from '@/src/lib/utils';
import { round2, resolvePrixCatalogueTTC } from '@/src/lib/devis-calculs';
import { useDevisLignes, makeLigneForm } from '@/src/hooks/useDevisLignes';
import DevisEditor from '@/src/components/DevisEditor';

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

  // Lignes + totaux (hook partagé)
  const devisLignes = useDevisLignes();
  const { lignes, setLignes, calculs, pourcentageAcompte } = devisLignes;

  // Catalogue
  const [catalogue, setCatalogue] = useState<ProduitCatalogue[]>([]);
  const [showCatalogueDropdown, setShowCatalogueDropdown] = useState(false);
  const [catalogueSearch, setCatalogueSearch] = useState('');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, demandeId, isDirect, sejourDirectId]);

  // ── Close catalogue dropdown on outside click ──
  useEffect(() => {
    if (!showCatalogueDropdown) return;
    const handler = () => { setShowCatalogueDropdown(false); setCatalogueSearch(''); };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showCatalogueDropdown]);

  // ── Submit ──
  const handleSubmit = async () => {
    setSending(true);

    const lignesData = devisLignes.lignesForApi();

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
  const sejour = demande?.sejour;

  const dateDevis = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const dateValidite = new Date(Date.now() + validiteJours * 86400000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // ── Slots spécifiques création ──

  const destinataireSlot = isDirect ? (
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
  );

  const objetSlot = isDirect ? (
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
  );

  const catalogueActionsSlot = catalogue.length > 0 ? (
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
                        prixUnitaire: String(resolvePrixCatalogueTTC(p)),
                        tva: String(p.tva),
                        produitCatalogueId: p.id,
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
                    <span className="text-xs text-gray-500 shrink-0 ml-2">{resolvePrixCatalogueTTC(p).toFixed(2)} € TTC</span>
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
                            prixUnitaire: String(resolvePrixCatalogueTTC(p)),
                            tva: String(p.tva),
                            produitCatalogueId: p.id,
                          })]);
                          setShowCatalogueDropdown(false);
                          setCatalogueSearch('');
                        }}
                        className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0"
                      >
                        <span className="text-sm text-gray-900 line-clamp-2">{p.nom}</span>
                        <span className="text-xs text-gray-500 shrink-0 ml-2">{resolvePrixCatalogueTTC(p).toFixed(2)} € TTC</span>
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
  ) : null;

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

        <DevisEditor
          nomEntreprise={nomEntreprise} onNomEntrepriseChange={setNomEntreprise}
          adresseEntreprise={adresseEntreprise} onAdresseEntrepriseChange={setAdresseEntreprise}
          siretEntreprise={siretEntreprise} onSiretEntrepriseChange={setSiretEntreprise}
          emailEntreprise={emailEntreprise} onEmailEntrepriseChange={setEmailEntreprise}
          telEntreprise={telEntreprise} onTelEntrepriseChange={setTelEntreprise}
          numeroDevis={numeroDevis}
          dateDevis={dateDevis}
          dateValidite={dateValidite}
          validiteJours={validiteJours}
          destinataire={destinataireSlot}
          objet={objetSlot}
          catalogueActions={catalogueActionsSlot}
          devisLignes={devisLignes}
          catalogue={catalogue}
          conditionsAnnulation={conditionsAnnulation}
          onConditionsAnnulationChange={setConditionsAnnulation}
          cancelHref={isDirect ? `/dashboard/sejour/${sejourDirectId}` : '/dashboard/hebergeur/demandes'}
          submitLabel={isDirect ? 'Enregistrer le devis' : 'Envoyer le devis'}
          submitLoadingLabel={isDirect ? 'Enregistrement...' : 'Envoi en cours...'}
          submitIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          }
          onSubmit={handleSubmit}
          sending={sending}
        />
      </main>
    </div>
  );
}
