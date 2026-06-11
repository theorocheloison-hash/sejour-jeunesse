import {
  IsOptional,
  IsString,
  MinLength,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LigneDevisDto } from './create-devis.dto.js';

export class UpdateDevisDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  montantTotal?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  montantParEleve?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  conditionsAnnulation?: string;

  @IsOptional()
  @IsString()
  nomEntreprise?: string;

  @IsOptional()
  @IsString()
  adresseEntreprise?: string;

  @IsOptional()
  @IsString()
  siretEntreprise?: string;

  @IsOptional()
  @IsString()
  emailEntreprise?: string;

  @IsOptional()
  @IsString()
  telEntreprise?: string;

  // Destinataire (devis complémentaire : payeur additionnel avec destinataire propre)
  @IsOptional()
  @IsString()
  destinataireNom?: string;

  @IsOptional()
  @IsString()
  destinataireAdresse?: string;

  @IsOptional()
  @IsString()
  destinataireCodePostal?: string;

  @IsOptional()
  @IsString()
  destinataireVille?: string;

  @IsOptional()
  @IsString()
  destinataireSiret?: string;

  @IsOptional()
  @IsString()
  destinataireEmail?: string;

  @IsOptional()
  @IsNumber()
  tauxTva?: number;

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
  pourcentageAcompte?: number;

  @IsOptional()
  @IsNumber()
  montantAcompte?: number;

  @IsOptional()
  @IsString()
  numeroDevis?: string;

  @IsOptional()
  @IsString()
  typeDevis?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LigneDevisDto)
  lignes?: LigneDevisDto[];

  @IsOptional()
  @IsNumber()
  nombreEleves?: number;

  @IsOptional()
  @IsNumber()
  nombreAccompagnateurs?: number;
}
