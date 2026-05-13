import {
  IsArray, IsBoolean, IsDateString, IsNotEmpty, IsNumber, IsOptional,
  IsString, IsUUID, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LigneDevisLibreDto {
  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  quantite!: number;

  @IsNumber()
  prixUnitaire!: number;

  @IsNumber()
  tva!: number;

  @IsNumber()
  totalHT!: number;

  @IsNumber()
  totalTTC!: number;
}

export class CreateDevisLibreDto {
  @IsString()
  @IsNotEmpty()
  nomClient!: string;

  @IsOptional()
  @IsString()
  prenomClient?: string;

  @IsOptional()
  @IsString()
  emailClient?: string;

  @IsOptional()
  @IsString()
  telClient?: string;

  @IsOptional()
  @IsString()
  adresseClient?: string;

  @IsOptional()
  @IsString()
  typeEvenement?: string;

  @IsDateString()
  dateDebut!: string;

  @IsDateString()
  dateFin!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  conditionsAnnulation?: string;

  @IsOptional()
  @IsString()
  notesInternes?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsOptional()
  @IsNumber()
  montantHT?: number;

  @IsOptional()
  @IsNumber()
  montantTVA?: number;

  @IsOptional()
  @IsNumber()
  montantTTC?: number;

  @IsOptional()
  @IsNumber()
  tauxTva?: number;

  @IsOptional()
  @IsNumber()
  pourcentageAcompte?: number;

  @IsOptional()
  @IsNumber()
  montantAcompte?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LigneDevisLibreDto)
  lignes?: LigneDevisLibreDto[];
}

export class UpdateDevisLibreDto extends CreateDevisLibreDto {}

export class AjouterVersementDto {
  @IsNumber()
  montant!: number;

  @IsDateString()
  datePaiement!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class SignerDevisDto {
  @IsString()
  @IsNotEmpty()
  nomSignataire!: string;

  @IsBoolean()
  confirmation!: boolean;
}
