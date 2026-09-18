import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';

export class SignerAutorisationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  taille?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  poids?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pointure?: number;

  @IsOptional()
  @IsString()
  regimeAlimentaire?: string;

  @IsOptional()
  @IsString()
  niveauSki?: string;

  @IsOptional()
  @IsString()
  infosMedicales?: string;

  // Lot 7a : santé structurée + statut d'attestation (formulaire parent dynamique)
  @IsOptional()
  @IsString()
  allergies?: string;

  @IsOptional()
  @IsIn(['FOURNIE', 'NON_FOURNIE', 'NON_CONCERNE'])
  attestationAquatique?: string;

  @IsOptional()
  @IsString()
  nomParent?: string;

  @IsOptional()
  @IsString()
  telephoneUrgence?: string;

  @IsOptional()
  @IsString()
  eleveDateNaissance?: string;

  @IsBoolean()
  rgpdAccepte!: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  nombreMensualites?: number;

  @IsOptional()
  @IsString()
  moyenPaiement?: string;

  @IsOptional()
  @IsBoolean()
  consentementMedical?: boolean;
}
