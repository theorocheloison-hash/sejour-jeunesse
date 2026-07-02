'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/src/contexts/AuthContext';
import { getDevisDetail, updateDevis, notifierEnseignantDevis } from '@/src/lib/devis';
import type { Devis, LigneDevis } from '@/src/lib/devis';
import { getCatalogue } from '@/src/lib/centre';
import type { ProduitCatalogue } from '@/src/lib/centre';
import { round2, resolvePrixCatalogueTTC, formatMontant } from '@/src/lib/devis-calculs';
import { useDevisLignes, makeLigneForm } from '@/src/hooks/useDevisLignes';
import DevisEditor from '@/src/components/DevisEditor';

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ModifierDevisPage() {
  const params = useParams();
  const devisId = params.id as string;
  const { user, isLoading } = useAuth();

  // Data
  const [devisOriginal, setDevisOriginal] = useState<Devis | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Company info
  const [nomEntreprise, setNomEntreprise] = useState('');
  const [adresseEntreprise, setAdresseEntreprise] = useState('');
  const [siretEntreprise, setSiretEntreprise] = useState('');
  const [emailEntreprise, setEmailEntreprise] = useState('');
  const [telEntreprise, setTelEntreprise] = useState('');

  // Lignes + totaux (hook partagé)
  const devisLignes = useDevisLignes([]);
  const { setLignes, calculs, pourcentageAcompte, setPourcentageAcompte } = devisLignes;

  // Catalogue
  const [catalogue, setCatalogue] = useState<ProduitCatalogue[]>([]);
  const [catalogueSearch, setCatalogueSearch] = useState('');
  const [showCatalogueSearch, setShowCatalogueSearch] = useState(false);

  const [numeroDevis, setNumeroDevis] = useState('');

  // Conditions
  const [conditionsAnnulation, setConditionsAnnulation] = useState('');
  const [validiteJours] = useState(30);

  // Submit state
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [nombreEleves, setNombreEleves] = useState<number>(0);
  const [nombreAccompagnateurs, setNombreAccompagnateurs] = useState<number>(0);


  // ── Load existing devis ──
  useEffect(() => {
    if (!user || !devisId) return;
    getDevisDetail(devisId)
      .then(({ devis, centre: c }) => {
        setDevisOriginal(devis);
        getCatalogue().then(setCatalogue).catch(() => {});
        // Pre-fill fields
        setNomEntreprise(devis.nomEntreprise ?? c.nom);
        setAdresseEntreprise(devis.adresseEntreprise ?? `${c.adresse}, ${c.codePostal} ${c.ville}`);
        setSiretEntreprise(devis.siretEntreprise ?? c.siret ?? '');
        setEmailEntreprise(devis.emailEntreprise ?? c.email ?? '');
        setTelEntreprise(devis.telEntreprise ?? c.telephone ?? '');
        setPourcentageAcompte(devis.pourcentageAcompte ?? 30);
        setNumeroDevis(devis.numeroDevis ?? '');
        setConditionsAnnulation(devis.conditionsAnnulation ?? c.conditionsAnnulation ?? '');
        setNombreEleves(devis.demande?.nombreEleves ?? 0);
        setNombreAccompagnateurs(devis.demande?.nombreAccompagnateurs ?? 0);
        // Pre-fill lignes
        if (devis.lignes && devis.lignes.length > 0) {
          setLignes(devis.lignes.map((l: LigneDevis) => {
            // Pré-remplir le champ « PU TTC » avec le prix TTC d'origine. On reconstitue
            // depuis totalTTC/quantite (et NON prixUnitaire×(1+tva)) pour garantir
            // l'idempotence : round2(79.55×1.10)=87.51 ≠ 87.50 saisi à l'origine.
            const puTTC = l.quantite > 0
              ? round2(l.totalTTC / l.quantite)
              : round2(l.prixUnitaire * (1 + l.tva / 100));
            return makeLigneForm({
              description: l.description,
              quantite: String(l.quantite),
              prixUnitaire: String(puTTC),
              tva: String(l.tva),
              produitCatalogueId: l.produitCatalogueId ?? undefined,
            });
          }));
        } else {
          setLignes([makeLigneForm()]);
        }
      })
      .catch(() => setLoadError('Impossible de charger le devis.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, devisId]);

  // ── Submit ──
  const handleSubmit = async () => {
    if (!devisOriginal) return;
    setSending(true);

    const lignesData = devisLignes.lignesForApi();

    const nbElevesParEleve = nombreEleves > 0 ? nombreEleves : (devisOriginal.demande?.nombreEleves ?? 1);

    try {
      await updateDevis(devisId, {
        montantTotal: calculs.montantTTC.toFixed(2),
        montantParEleve: (calculs.montantTTC / nbElevesParEleve).toFixed(2),
        description: devisOriginal.description ?? undefined,
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
        typeDevis: devisOriginal.typeDevis ?? 'PLATEFORME',
        lignes: lignesData,
        nombreEleves: nombreEleves !== null && nombreEleves !== undefined ? nombreEleves : undefined,
        nombreAccompagnateurs: nombreAccompagnateurs !== null && nombreAccompagnateurs !== undefined ? nombreAccompagnateurs : undefined,
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
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/dashboard/hebergeur/devis" className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-colors">
              Voir mes devis
            </Link>
            <button
              onClick={async () => {
                setNotifying(true);
                try {
                  await notifierEnseignantDevis(devisId);
                  setNotified(true);
                } catch { /* ignore */ }
                finally { setNotifying(false); }
              }}
              disabled={notifying || notified}
              className="rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {notified ? '✓ Enseignant notifié' : notifying ? 'Envoi...' : '📧 Notifier l\'enseignant'}
            </button>
          </div>
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
  const sejourDirect = devisOriginal?.sejourDirect; // devis DIRECT (pas de demande/enseignant)

  const dateDevis = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const dateValidite = new Date(Date.now() + validiteJours * 86400000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const fmt = formatMontant;

  // Facture d'acompte déjà émise (figée) : ses lignes/montant ne bougent pas. Les
  // modifications du devis n'ajustent QUE la future facture de solde (total révisé − acompte).
  const factureAcompte = devisOriginal?.factures?.find(f => f.typeFacture === 'ACOMPTE') ?? null;

  // ── Slots spécifiques édition ──

  const destinataireSlot = demande?.enseignant ? (
    <div className="text-sm text-gray-700 space-y-1">
      <p className="font-semibold">{demande.enseignant.prenom} {demande.enseignant.nom}</p>
      {demande.enseignant.memberships?.[0]?.organisation.nom && (
        <p className="font-medium text-gray-600">{demande.enseignant.memberships[0].organisation.nom}</p>
      )}
      {demande.enseignant.memberships?.[0]?.organisation.ville && (
        <p className="text-gray-500">{demande.enseignant.memberships[0].organisation.ville}</p>
      )}
      {demande.enseignant.email && <p className="text-gray-500">{demande.enseignant.email}</p>}
    </div>
  ) : sejourDirect ? (
    <div className="text-sm text-gray-700 space-y-1">
      {sejourDirect.clientOrganisation && <p className="font-semibold">{sejourDirect.clientOrganisation}</p>}
      {sejourDirect.clientNom && (
        <p className={sejourDirect.clientOrganisation ? 'text-gray-600' : 'font-semibold'}>{sejourDirect.clientNom}</p>
      )}
      {sejourDirect.clientEmail && <p className="text-gray-500">{sejourDirect.clientEmail}</p>}
    </div>
  ) : (
    <p className="text-sm text-gray-400">Information non disponible</p>
  );

  const objetSlot = (
    <div className="space-y-3">
      {sejour ? (
        <p className="text-sm font-semibold text-gray-900">
          Séjour — {sejour.titre}
        </p>
      ) : sejourDirect ? (
        <p className="text-sm font-semibold text-gray-900">
          Séjour — {sejourDirect.titre}
        </p>
      ) : demande ? (
        <p className="text-sm font-semibold text-gray-900">
          {demande.titre}
        </p>
      ) : (
        <p className="text-sm text-gray-400">Chargement...</p>
      )}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Participants</label>
          <input
            type="number"
            min={0}
            value={nombreEleves}
            onChange={e => setNombreEleves(Number(e.target.value))}
            className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
        <span className="text-gray-400 text-sm">+</span>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Accompagnants</label>
          <input
            type="number"
            min={0}
            value={nombreAccompagnateurs}
            onChange={e => setNombreAccompagnateurs(Number(e.target.value))}
            className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>
        {(nombreEleves > 0 || nombreAccompagnateurs > 0) && (
          <span className="text-xs text-gray-400">
            = {nombreEleves + nombreAccompagnateurs} personnes
          </span>
        )}
      </div>
    </div>
  );

  const catalogueActionsSlot = (
    <>
      {catalogue.length > 0 && (
        <div className="relative">
          {!showCatalogueSearch ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowCatalogueSearch(true); setCatalogueSearch(''); }}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
              </svg>
              Depuis le catalogue
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  autoFocus
                  type="text"
                  value={catalogueSearch}
                  onChange={(e) => setCatalogueSearch(e.target.value)}
                  onBlur={() => setTimeout(() => setShowCatalogueSearch(false), 150)}
                  placeholder="Rechercher un produit..."
                  className="w-96 rounded-lg border border-[var(--color-primary)] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30"
                />
                {catalogueSearch.length >= 2 && (() => {
                  const results = catalogue.filter(p =>
                    p.nom.toLowerCase().includes(catalogueSearch.toLowerCase())
                  );
                  if (results.length === 0) return (
                    <div className="absolute left-0 top-9 z-50 w-96 bg-white rounded-xl border border-gray-200 shadow-lg px-3 py-2 text-xs text-gray-400">
                      Aucun produit trouvé
                    </div>
                  );
                  return (
                    <div className="absolute left-0 top-9 z-50 w-96 bg-white rounded-xl border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                      {results.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            const nbElevesInitial = devisOriginal?.demande?.nombreEleves ?? 1;
                            setLignes(prev => [...prev, makeLigneForm({
                              description: p.nom,
                              quantite: String(nbElevesInitial),
                              prixUnitaire: String(resolvePrixCatalogueTTC(p)),
                              tva: String(p.tva),
                              produitCatalogueId: p.id,
                            })]);
                            setCatalogueSearch('');
                            setShowCatalogueSearch(false);
                          }}
                          className="w-full flex items-start justify-between gap-2 px-3 py-2 text-left hover:bg-[var(--color-primary-light)] border-b border-gray-50 last:border-0"
                        >
                          <span className="text-sm text-gray-900 line-clamp-2">{p.nom}</span>
                          <span className="text-xs text-gray-500">{resolvePrixCatalogueTTC(p).toFixed(2)} € TTC</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogueSearch(false)}
                className="text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}
      <a
        href="/dashboard/hebergeur/catalogue"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-gray-400 hover:text-[var(--color-primary)] underline"
      >
        Gérer mon catalogue ↗
      </a>
    </>
  );

  const totauxExtraSlot = factureAcompte && calculs.montantTTC < factureAcompte.montantFacture ? (
    <p className="text-red-600 text-sm mt-1">
      ⚠️ Le nouveau total ({fmt(calculs.montantTTC)} €) est inférieur à l&apos;acompte déjà facturé ({fmt(factureAcompte.montantFacture)} €).
      Vous devrez émettre un avoir avant de facturer le solde.
    </p>
  ) : null;

  return (
    <div className="min-h-screen bg-gray-100">
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/dashboard/hebergeur/devis" className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary)] font-medium">&larr; Retour aux devis</Link>
            </div>
            <span className="text-sm font-semibold text-gray-700">Modifier le devis</span>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && (
          <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{loadError}</div>
        )}

        {factureAcompte && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 mb-6">
            <strong>⚠️ Ce devis a une facture d&apos;acompte émise ({factureAcompte.numero} — {fmt(factureAcompte.montantFacture)} €).</strong>
            <br />Vos modifications ajusteront le montant de la facture de solde. L&apos;acompte déjà facturé ne sera pas modifié.
          </div>
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
          totauxExtra={totauxExtraSlot}
          devisLignes={devisLignes}
          catalogue={catalogue}
          conditionsAnnulation={conditionsAnnulation}
          onConditionsAnnulationChange={setConditionsAnnulation}
          cancelHref="/dashboard/hebergeur/devis"
          submitLabel="Enregistrer les modifications"
          submitLoadingLabel="Modification en cours..."
          submitIcon={
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
            </svg>
          }
          onSubmit={handleSubmit}
          sending={sending}
        />
      </main>
    </div>
  );
}
