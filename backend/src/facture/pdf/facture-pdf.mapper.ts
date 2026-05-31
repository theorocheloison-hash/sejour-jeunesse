import type { Facture, LigneFacture, VersementPaiement } from '@prisma/client';
import type { FacturePDFProps } from './FacturePDF.js';

type FactureWithLignes = Facture & {
  lignes: LigneFacture[];
  versements?: VersementPaiement[];
};

/** Mappe une Facture (snapshot figé + ses lignes) vers les props du template PDF. */
export function mapFactureToPdfProps(facture: FactureWithLignes, titreSejour: string): FacturePDFProps {
  // dateEcheance = dateEmission + 30 jours
  const dateEcheance = new Date(facture.dateEmission);
  dateEcheance.setDate(dateEcheance.getDate() + 30);

  return {
    typeFacture: facture.typeFacture as 'ACOMPTE' | 'SOLDE',
    numero: facture.numero,
    dateEmission: facture.dateEmission.toISOString(),
    dateEcheance: dateEcheance.toISOString(),
    emetteurNom: facture.emetteurNom,
    emetteurAdresse: facture.emetteurAdresse,
    emetteurSiret: facture.emetteurSiret,
    emetteurTva: facture.emetteurTva,
    emetteurEmail: facture.emetteurEmail,
    emetteurTel: facture.emetteurTel,
    emetteurIban: facture.emetteurIban,
    destinataireNom: facture.destinataireNom,
    destinataireAdresse: facture.destinataireAdresse,
    destinataireSiret: facture.destinataireSiret,
    destinataireEmail: facture.destinataireEmail,
    titreSejour: titreSejour || 'Non renseigné',
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
    versements: (facture.versements ?? []).map((v) => ({
      datePaiement: v.datePaiement.toISOString(),
      montant: v.montant,
      reference: v.reference,
      modePaiement: v.modePaiement,
    })),
  };
}
