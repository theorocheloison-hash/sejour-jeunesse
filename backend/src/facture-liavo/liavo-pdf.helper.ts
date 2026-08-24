import type { FacturePDFProps } from '../facture/pdf/FacturePDF.js';

// Identité émetteur LIAVO — figée pour toutes les pièces (factures FL- et devis DL-).
// LIAVO_SIRET/LIAVO_IBAN lus depuis l'env (mêmes valeurs et mêmes défauts
// qu'auparavant dans facture-liavo.service.ts).
const LIAVO_SIRET = process.env.LIAVO_SIRET ?? '102 994 910 00010';
const LIAVO_IBAN = process.env.LIAVO_IBAN ?? null;

export interface LiavoPdfParamsInput {
  typeFacture: 'DEVIS' | 'FACTURE';
  numero: string;
  dateEmission: string; // ISO
  dateEcheance: string; // ISO
  montantCents: number;
  destinataire: { nom: string; adresse: string | null; siret: string | null; email: string | null };
  libelle: string;
  conditionsTitre?: string | null;
  conditionsAnnulation?: string | null;
}

/**
 * Construit l'objet FacturePDFProps commun à TOUTES les pièces LIAVO : émetteur
 * figé (LIAVO SASU), TVA non applicable (art. 293 B du CGI), une seule ligne
 * portant le montant total. Les pièces LIAVO ont toujours HT == TTC et TVA == 0,
 * d'où un unique montantCents en entrée.
 *
 * Unique source du bloc de params PDF, consommée par genererDevisLiavo, emettre,
 * regenererPdf (et le devis-période) — remplace les trois objets construits
 * inline à l'identique.
 */
export function buildLiavoPdfParams(input: LiavoPdfParamsInput): FacturePDFProps {
  const montantEuros = input.montantCents / 100;
  return {
    typeFacture: input.typeFacture,
    logoUrl: null,
    numero: input.numero,
    dateEmission: input.dateEmission,
    dateEcheance: input.dateEcheance,
    emetteurNom: 'LIAVO SASU',
    emetteurAdresse: '472 Route du Mas Devant, 74440 Morillon',
    emetteurSiret: LIAVO_SIRET,
    emetteurTva: null,
    emetteurEmail: 'contact@liavo.fr',
    emetteurTel: null,
    emetteurIban: LIAVO_IBAN,
    destinataireNom: input.destinataire.nom,
    destinataireAdresse: input.destinataire.adresse,
    destinataireSiret: input.destinataire.siret,
    destinataireEmail: input.destinataire.email,
    titreSejour: input.libelle,
    lignes: [{
      description: input.libelle,
      quantite: 1,
      prixUnitaire: montantEuros,
      tva: 0,
      totalHT: montantEuros,
      totalTTC: montantEuros,
    }],
    montantHT: montantEuros,
    montantTVA: 0,
    montantTTC: montantEuros,
    montantFacture: montantEuros,
    pourcentageAcompte: null,
    montantAcompteDejaFacture: null,
    conditionsTitre: input.conditionsTitre ?? null,
    conditionsAnnulation: input.conditionsAnnulation ?? null,
    tauxTva: 0,
    mentionTVA: 'TVA non applicable, art. 293 B du CGI',
  };
}
