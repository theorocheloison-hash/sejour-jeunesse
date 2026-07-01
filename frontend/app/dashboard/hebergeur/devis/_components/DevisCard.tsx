'use client';

import Link from 'next/link';
import { getFactureAcompte, getFactureSolde } from '@/src/lib/devis';
import type { Devis, StatutDevis } from '@/src/lib/devis';
import type { CategorieAlerte } from '@/src/lib/devisAlertes';
import { resolveSejourDateFin } from '@/src/lib/devisAlertes';
import DevisPDFButton from '@/src/components/pdf/DevisPDFButton';
import type { DevisPDFProps } from '@/src/components/pdf/DevisPDF';

// ─── Format monétaire unifié ─────────────────────────────────────────────────

const fmtMoney = (n: number) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

// ─── Normalize + Highlight (partagés avec la page — pas de duplication) ───────

export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function Highlight({ text, query }: { text: string; query: string }) {
  if (!query || query.length < 2) return <>{text}</>;
  const normalizedQuery = normalize(query);
  const normalizedText = normalize(text);
  const idx = normalizedText.indexOf(normalizedQuery);
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

// ─── Statut badge (dérivé) ────────────────────────────────────────────────────

const STATUT_BADGE: Record<StatutDevis, { label: string; cls: string }> = {
  EN_ATTENTE:            { label: 'En attente',          cls: 'bg-orange-100 text-orange-700' },
  EN_ATTENTE_VALIDATION: { label: 'En validation',       cls: 'bg-blue-100 text-blue-700' },
  SELECTIONNE:           { label: 'Sélectionné',         cls: 'bg-[var(--color-success-light)] text-[var(--color-success)]' },
  SIGNE_DIRECTION:       { label: 'Signé',               cls: 'bg-purple-100 text-purple-700' },
  NON_RETENU:            { label: 'Non retenu',          cls: 'bg-gray-100 text-gray-600' },
  FACTURE_ACOMPTE:       { label: 'Facture acompte',     cls: 'bg-indigo-100 text-indigo-700' },
  FACTURE_SOLDE:         { label: 'Facture solde',       cls: 'bg-teal-100 text-teal-700' },
};

// ─── Sévérité de l'alerte (aligné sur les couleurs du bandeau) ────────────────
// Rouge : soldes/acomptes en retard. Ambre : à valider / à relancer / à facturer.
const CATS_ROUGES = new Set<CategorieAlerte>(['soldesARelancer', 'acomptesARelancer']);

// ─── Helpers d'affichage ──────────────────────────────────────────────────────

function resolveContact(d: Devis): { nom: string; email: string | null; tel: string | null } {
  const c = d.demande?.sejour?.createur;
  const e = d.demande?.enseignant;
  const sd = d.sejourDirect;
  // Priorité : createur collab > enseignant collab > destinataire du devis (rempli à la création
  // pour direct et complémentaire, aussi présent sur les imports Sauvageon) > clientNom du sejourDirect (fallback ultime).
  const nom = c
    ? `${c.prenom} ${c.nom}`
    : e
    ? `${e.prenom} ${e.nom}`
    : d.destinataireNom ?? sd?.clientNom ?? '';
  const email = e?.email ?? d.destinataireEmail ?? sd?.clientEmail ?? null;
  // Le type Devis n'a pas de destinataireTelephone. Uniquement enseignant.telephone (collab).
  const tel = e?.telephone ?? null;
  return { nom, email, tel };
}

function resolveEtablissement(d: Devis): string {
  return d.demande?.sejour?.createur?.memberships?.[0]?.organisation?.nom
    ?? d.demande?.enseignant?.memberships?.[0]?.organisation?.nom
    ?? d.sejourDirect?.clientOrganisation
    ?? '';
}

/** Date de référence de l'alerte selon la catégorie, pour la pastille « J+X ». */
function refDateForCategorie(d: Devis, cat: CategorieAlerte): string {
  const fa = getFactureAcompte(d);
  const fs = getFactureSolde(d);
  switch (cat) {
    case 'devisARelancer': return d.createdAt;
    case 'aFacturer':      return fa && !fs ? resolveSejourDateFin(d) : d.createdAt;
    case 'acomptesARelancer':
    case 'acomptesAValider': return fa?.dateEmission ?? d.createdAt;
    case 'soldesARelancer':  return fs?.dateEmission ?? d.createdAt;
  }
}

function joursDepuis(iso: string): number {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function buildPdfProps(d: Devis): DevisPDFProps {
  const ens = d.demande?.enseignant;
  const sejour = d.demande?.sejour;
  const htCalc = Number(d.montantHT) || (d.lignes ?? []).reduce((sum, l) => sum + Number(l.totalHT), 0);
  const ttcCalc = Number(d.montantTTC) || Number(d.montantTotal) || 0;
  const tvaCalc = Number(d.montantTVA) || (d.lignes ?? []).reduce((sum, l) => sum + (Number(l.totalHT) * (Number(l.tva) / 100)), 0) || (ttcCalc - htCalc);
  return {
    typeDocument: d.typeDocument === 'FACTURE_ACOMPTE' ? 'FACTURE_ACOMPTE' : d.typeDocument === 'FACTURE_SOLDE' ? 'FACTURE_SOLDE' : 'DEVIS',
    numeroDocument: d.numeroDevis ?? d.numeroFacture ?? `DEV-${d.id.substring(0, 8).toUpperCase()}`,
    dateDocument: d.createdAt,
    nomEmetteur: d.nomEntreprise ?? d.centre?.nom ?? '',
    adresseEmetteur: d.adresseEntreprise ?? [d.centre?.adresse, d.centre?.codePostal, d.centre?.ville].filter(Boolean).join(', '),
    siretEmetteur: d.siretEntreprise ?? d.centre?.siret ?? undefined,
    emailEmetteur: d.emailEntreprise ?? d.centre?.email ?? undefined,
    telEmetteur: d.telEntreprise ?? d.centre?.telephone ?? undefined,
    tvaEmetteur: d.centre?.tvaIntracommunautaire ?? undefined,
    ibanEmetteur: d.centre?.iban ?? undefined,
    nomDestinataire: ens ? `${ens.prenom} ${ens.nom}` : '',
    etablissementNom: ens?.memberships?.[0]?.organisation.nom ?? undefined,
    adresseDestinataire: ens?.memberships?.[0]?.organisation.ville ?? undefined,
    emailDestinataire: ens?.email ?? undefined,
    telDestinataire: ens?.telephone ?? undefined,
    titreSejour: sejour?.titre ?? d.demande?.titre ?? '',
    lieuSejour: d.demande?.villeHebergement,
    dateDebutSejour: sejour?.dateDebut ?? undefined,
    dateFinSejour: sejour?.dateFin ?? undefined,
    nombreEleves: d.demande?.nombreEleves,
    niveauClasse: sejour?.niveauClasse ?? undefined,
    lignes: (d.lignes ?? []).map(l => ({
      description: l.description,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      tva: l.tva,
      totalHT: l.totalHT,
      totalTTC: l.totalTTC,
    })),
    montantHT: htCalc,
    montantTVA: tvaCalc,
    montantTTC: ttcCalc,
    montantAcompte: d.montantAcompte != null ? Number(d.montantAcompte) : undefined,
    montantSolde: d.montantSolde != null ? Number(d.montantSolde) : undefined,
    pourcentageAcompte: d.pourcentageAcompte ?? undefined,
    conditionsAnnulation: d.conditionsAnnulation ?? d.centre?.conditionsAnnulation ?? undefined,
    dateValidite: d.dateFacture
      ? new Date(new Date(d.dateFacture).getTime() + 30 * 86400000).toISOString()
      : new Date(new Date(d.createdAt).getTime() + 30 * 86400000).toISOString(),
    signatureDirecteur: d.signatureDirecteur ?? undefined,
    logoUrl: d.centre?.logoUrl ?? null,
  };
}

// ─── Composant ────────────────────────────────────────────────────────────────

interface DevisCardProps {
  devis: Devis;
  categorieAlerte?: CategorieAlerte | null; // pour bordure + pastille « J+X »
  searchQuery: string;
}

export default function DevisCard({ devis: d, categorieAlerte, searchQuery }: DevisCardProps) {
  const fa = getFactureAcompte(d);
  const fs = getFactureSolde(d);
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  // Badge dérivé des factures liées (le devis reste SELECTIONNE/SIGNE_DIRECTION).
  const badge = fs
    ? { label: 'Soldé', cls: 'bg-teal-100 text-teal-700' }
    : fa
    ? { label: 'Acompte facturé', cls: 'bg-indigo-100 text-indigo-700' }
    : (STATUT_BADGE[d.statut] ?? STATUT_BADGE.EN_ATTENTE);

  // Titre + résolution du séjour (soft-delete pris en compte).
  const sejourDirectSupprime = !!d.sejourDirectId && (!d.sejourDirect || !!d.sejourDirect.deletedAt);
  const sejourTitre =
    d.demande?.sejour?.titre
    ?? d.demande?.titre
    ?? (sejourDirectSupprime
      ? 'Séjour supprimé'
      : d.sejourDirect?.titre ?? (d.sejourDirectId ? 'Séjour direct' : 'Devis'));
  const sejourId = sejourDirectSupprime
    ? (d.demande?.sejour?.id ?? null)
    : (d.sejourDirectId ?? d.demande?.sejour?.id ?? null);
  const dossierDisabled = !sejourId || sejourDirectSupprime;

  const contact = resolveContact(d);
  const etablissement = resolveEtablissement(d);
  const dateDebut = d.demande?.sejour?.dateDebut ?? d.sejourDirect?.dateDebut;
  const dateFin = d.demande?.sejour?.dateFin ?? d.sejourDirect?.dateFin;
  const total = Number(d.montantTTC) || Number(d.montantTotal) || 0;

  // Alerte : bordure + pastille colorées selon la sévérité de la catégorie.
  const enAlerte = !!categorieAlerte;
  const rouge = !!categorieAlerte && CATS_ROUGES.has(categorieAlerte);
  const borderCls = enAlerte
    ? (rouge ? 'border-l-[3px] border-l-red-500' : 'border-l-[3px] border-l-amber-400')
    : 'border-l-[3px] border-l-transparent';
  const jX = categorieAlerte ? joursDepuis(refDateForCategorie(d, categorieAlerte)) : 0;

  // Facture émise → PDF Factur-X stocké (le solde prime sur l'acompte).
  const facturePdfUrl = fs?.pdfUrl ?? fa?.pdfUrl ?? null;

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm p-5 ${borderCls}`}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* En-tête */}
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <h3 className="font-semibold text-gray-900">
              {sejourId ? (
                <Link href={`/dashboard/sejour/${sejourId}`} className="hover:text-[var(--color-primary)] hover:underline">
                  <Highlight text={sejourTitre} query={searchQuery} />
                </Link>
              ) : (
                <Highlight text={sejourTitre} query={searchQuery} />
              )}
            </h3>
            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.cls}`}>
              {badge.label}
            </span>
            {d.isComplementaire && (
              <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                Complémentaire
              </span>
            )}
            {enAlerte && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${
                rouge ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {rouge ? '🔴' : '🟠'} J+{jX}
              </span>
            )}
          </div>

          {/* Contact — toujours visible */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-600 mb-1">
            {contact.nom && (
              <span className="font-medium text-gray-700">
                <Highlight text={contact.nom} query={searchQuery} />
              </span>
            )}
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="text-[var(--color-primary)] hover:underline">
                {contact.email}
              </a>
            )}
            {contact.tel && (
              <a href={`tel:${contact.tel}`} className="text-[var(--color-primary)] hover:underline">
                {contact.tel}
              </a>
            )}
            {!contact.nom && !contact.email && !contact.tel && (
              <span className="text-gray-400 italic">Contact non renseigné</span>
            )}
          </div>

          {/* Infos */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
            {etablissement && (
              <span><Highlight text={etablissement} query={searchQuery} /></span>
            )}
            {dateDebut && dateFin && (
              <span className="font-medium text-gray-600">{fmtDate(dateDebut)} → {fmtDate(dateFin)}</span>
            )}
            <span>Total : {fmtMoney(total)}</span>
            {d.numeroDevis && (
              <span className="text-gray-400"><Highlight text={d.numeroDevis} query={searchQuery} /></span>
            )}
            {fa && (
              <span className="text-gray-400">FA <Highlight text={fa.numero} query={searchQuery} /></span>
            )}
            {fs && (
              <span className="text-gray-400">FS <Highlight text={fs.numero} query={searchQuery} /></span>
            )}
            {(d.nomSignataireDirecteur || d.dateSignatureDirecteur || d.signatureDirecteur) && (
              <span className="text-purple-600">
                ·{' '}
                {d.nomSignataireDirecteur
                  ? <>Signé par {d.nomSignataireDirecteur}
                      {d.dateSignatureDirecteur && ` le ${new Date(d.dateSignatureDirecteur).toLocaleDateString('fr-FR')}`}
                    </>
                  : d.signatureDirecteur /* Fallback : chaîne composite des vieux imports Sauvageon */}
              </span>
            )}
          </div>

          {/* Info d'état — factures émises */}
          {(fa || fs) && (
            <div className="mt-3 flex flex-col gap-1.5">
              {fa && (
                <div className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  fa.acompteVerse
                    ? 'border-[var(--color-success)]/20 bg-[var(--color-success-light)] text-[var(--color-success)]'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}>
                  Facture acompte — {fa.numero} — {fmtMoney(fa.montantFacture)} ·{' '}
                  {fa.acompteVerse
                    ? 'Acompte validé ✓'
                    : (fa.montantVerseTotal ?? 0) > 0
                      ? `Reçu ${fmtMoney(Number(fa.montantVerseTotal))}`
                      : 'En attente de paiement'}
                </div>
              )}
              {fs && (
                <div className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  (fs.montantVerseTotal ?? 0) >= fs.montantFacture * 0.99
                    ? 'border-teal-200 bg-teal-50 text-teal-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
                }`}>
                  Facture solde — {fs.numero} — {fmtMoney(fs.montantFacture)}
                  {(fs.montantVerseTotal ?? 0) >= fs.montantFacture * 0.99
                    ? ' · Soldé ✓'
                    : ` · Reste : ${fmtMoney(fs.montantFacture - (fs.montantVerseTotal ?? 0))}`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Actions : Voir · PDF · Ouvrir le dossier ── */}
        <div className="shrink-0 flex flex-row flex-wrap sm:flex-col items-start sm:items-end gap-2">
          {facturePdfUrl ? (
            <div className="inline-flex rounded-lg border border-gray-300 overflow-hidden">
              <a
                href={facturePdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Afficher le PDF"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors border-r border-gray-300"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Voir
              </a>
              <a
                href={facturePdfUrl}
                download
                title="Télécharger le PDF"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                PDF
              </a>
            </div>
          ) : (
            <DevisPDFButton
              key={`pdf-${d.id}-${d.demande?.nombreEleves ?? 0}-${d.demande?.nombreAccompagnateurs ?? 0}`}
              data={buildPdfProps(d)}
              filename={`devis-${(d.numeroDevis ?? d.id).substring(0, 8)}.pdf`}
              label="PDF"
            />
          )}

          {dossierDisabled ? (
            <span
              title={sejourDirectSupprime ? 'Séjour supprimé' : 'Dossier indisponible'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-400 cursor-not-allowed"
            >
              Ouvrir le dossier
            </span>
          ) : (
            <Link
              href={`/dashboard/sejour/${sejourId}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-colors"
            >
              Ouvrir le dossier
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
