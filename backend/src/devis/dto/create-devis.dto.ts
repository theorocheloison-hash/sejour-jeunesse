import {
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  IsNumber,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LigneDevisDto {
  @IsString()
  @MinLength(1)
  description!: string;

  @IsNumber()
  quantite!: number;

  @IsNumber()
  prixUnitaire!: number;

  @IsNumber()
  @IsOptional()
  tva?: number;

  @IsNumber()
  totalHT!: number;

  @IsNumber()
  totalTTC!: number;
}

export class CreateDevisDto {
  @IsUUID()
  demandeId!: string;

  @IsString()
  @MinLength(1)
  montantTotal!: string;

  @IsString()
  @MinLength(1)
  montantParEleve!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  conditionsAnnulation?: string;

  // ── Champs professionnels ──

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
}
