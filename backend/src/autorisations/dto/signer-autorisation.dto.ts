import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min, Max } from 'class-validator';

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
  @MaxLength(100)
  regimeAlimentaire?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
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

  // Bloc B « sexe » (décision 25/09) : le parent le déclare si le séjour l'a
  // demandé — écrit en hebergementCategorie par signer() via CHAMP_PAR_CLE.
  @IsOptional()
  @IsIn(['FILLE', 'GARCON', 'AUTRE'])
  sexe?: 'FILLE' | 'GARCON' | 'AUTRE';

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nomParent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
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
  @MaxLength(20)
  moyenPaiement?: string;

  @IsOptional()
  @IsBoolean()
  consentementMedical?: boolean;
}
