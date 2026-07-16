import type { Facture, LigneFacture, VersementPaiement } from '@prisma/client';
import type { FacturePDFProps } from './FacturePDF.js';

type FactureWithLignesEtendue = Facture & {
  lignes: LigneFacture[];
  versements?: VersementPaiement[];
  factureAnnulee?: { numero: string; dateEmission: Date } | null;
  // Refacto facture-solde : facture d'acompte liée (ligne « Acompte déjà
  // encaissé (FA-… du …) » du PDF de solde).
  factureAcompte?: { numero: string; dateEmission: Date; montantVerseTotal: number } | null;
};

/**
 * Reconstitue une adresse lisible pour l'affichage PDF depuis la sérialisation
 * structurée "adresse||codePostal||ville" (cf. construireEmetteur/Destinataire).
 * Fallback : adresse brute (anciennes factures / champ pro libre).
 */
function formatAdressePdf(raw: string | null): string | null {
  if (!raw) return null;
  const parts = raw.split('||');
  if (parts.length === 3) return `${parts[0]}, ${parts[1]} ${parts[2]}`;
  return raw;
}

/** Mappe une Facture (snapshot figé + ses lignes) vers les props du template PDF. */
export function mapFactureToPdfProps(
  facture: FactureWithLignesEtendue,
  titreSejour: string,
  logoUrl?: string | null,
): FacturePDFProps {
  // dateEcheance = dateEmission + 30 jours
  const dateEcheance = new Date(facture.dateEmission);
  dateEcheance.setDate(dateEcheance.getDate() + 30);

  return {
    typeFacture: facture.typeFacture as 'ACOMPTE' | 'SOLDE' | 'AVOIR',
    logoUrl: logoUrl ?? null,
    numero: facture.numero,
    dateEmission: facture.dateEmission.toISOString(),
    dateEcheance: dateEcheance.toISOString(),
    emetteurNom: facture.emetteurNom,
    emetteurAdresse: formatAdressePdf(facture.emetteurAdresse),
    emetteurSiret: facture.emetteurSiret,
    emetteurTva: facture.emetteurTva,
    emetteurEmail: facture.emetteurEmail,
    emetteurTel: facture.emetteurTel,
    emetteurIban: facture.emetteurIban,
    destinataireNom: facture.destinataireNom,
    destinataireAdresse: formatAdressePdf(facture.destinataireAdresse),
    destinataireSiret: facture.destinataireSiret,
    destinataireEmail: facture.destinataireEmail,
    titreSejour: `Séjour — ${titreSejour || 'Non renseigné'}`,
    lignes: facture.lignes.map((l) => ({
      description: l.description,
      quantite: l.quantite,
      prixUnitaire: l.prixUnitaire,
      tva: l.tva,
      totalHT: l.totalHT,
      totalTTC: l.totalTTC,
    })),
    montantHT: facture.montantHT,
    montantTVA: facture.montantTVA,
    montantTTC: facture.montantTTC,
    montantFacture: facture.montantFacture,
    pourcentageAcompte: facture.pourcentageAcompte ?? null,
    montantAcompteDejaFacture: facture.montantAcompteDejaFacture ?? null,
    conditionsAnnulation: facture.conditionsAnnulation ?? null,
    tauxTva: facture.tauxTva,
    // Avoir (Lot 3) : référence à la facture annulée + motif
    factureAnnuleeNumero: facture.factureAnnulee?.numero ?? null,
    factureAnnuleeDate: facture.factureAnnulee?.dateEmission?.toISOString() ?? null,
    motifAvoir: facture.motifAvoir ?? null,
    versements: (facture.versements ?? []).map((v) => ({
      datePaiement: v.datePaiement.toISOString(),
      montant: v.montant,
      reference: v.reference,
      modePaiement: v.modePaiement,
    })),
    // Refacto facture-solde : référence de l'acompte lié — présente seulement si
    // la requête d'origine a chargé la relation (props optionnelles, additives).
    factureAcompteNumero: facture.factureAcompte?.numero ?? null,
    factureAcompteDate: facture.factureAcompte?.dateEmission?.toISOString() ?? null,
  };
}
