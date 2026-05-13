export class LigneDevisLibreDto {
  description!: string;
  quantite!: number;
  prixUnitaire!: number;
  tva!: number;
  totalHT!: number;
  totalTTC!: number;
}

export class CreateDevisLibreDto {
  nomClient!: string;
  prenomClient?: string;
  emailClient?: string;
  telClient?: string;
  adresseClient?: string;
  typeEvenement?: string;
  dateDebut!: string;
  dateFin!: string;
  description?: string;
  conditionsAnnulation?: string;
  notesInternes?: string;
  clientId?: string;
  montantHT?: number;
  montantTVA?: number;
  montantTTC?: number;
  tauxTva?: number;
  pourcentageAcompte?: number;
  montantAcompte?: number;
  lignes?: LigneDevisLibreDto[];
}

export class UpdateDevisLibreDto extends CreateDevisLibreDto {}

export class AjouterVersementDto {
  montant!: number;
  datePaiement!: string;
  reference?: string;
}

export class SignerDevisDto {
  nomSignataire!: string;
  confirmation!: boolean;
}
