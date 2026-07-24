import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

/**
 * Saisie directe (grille organisateur) — DTO EXHAUSTIF sur l'interface
 * ParticipantDirectInput du service : le ValidationPipe global est
 * { whitelist: true } SANS forbidNonWhitelisted → tout champ non décoré est
 * STRIPPÉ EN SILENCE du body (perte de données sans erreur). Un champ ajouté
 * à l'interface DOIT être ajouté ici. Types calés sur le payload réel du
 * front (TabParticipantsSaisieDirecte : numOrNull → number natif, jamais de
 * string numérique ; les vides arrivent en null explicite, passés par
 * @IsOptional). MaxLength = les VarChar du schéma.
 */
export class ParticipantDirectDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  eleveNom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  elevePrenom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  parentEmail?: string | null;

  @IsOptional()
  @IsNumber()
  taille?: number | null;

  @IsOptional()
  @IsNumber()
  poids?: number | null;

  @IsOptional()
  @IsNumber()
  pointure?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  niveauSki?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  regimeAlimentaire?: string | null;

  // Date en string (JJ/MM ou ISO) — le service parse (parseDateOrNull)
  @IsOptional()
  @IsString()
  eleveDateNaissance?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nomParent?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telephoneUrgence?: string | null;

  @IsOptional()
  @IsString()
  infosMedicales?: string | null;

  // Objet libre : la whitelist ne descend pas dans un objet non typé — les
  // clés custom sont préservées telles quelles.
  @IsOptional()
  @IsObject()
  champsPersonnalises?: Record<string, unknown> | null;

  // Le champ de la faille : null passe (@IsOptional), hors liste → 400
  // (couvre aussi le VarChar(10) — plus de 500 Postgres possible).
  @IsOptional()
  @IsIn(['FILLE', 'GARCON', 'AUTRE'])
  hebergementCategorie?: 'FILLE' | 'GARCON' | 'AUTRE' | null;
}

// Batch enveloppé — même pattern nested qu'AjouterLitsDto.
export class BatchDirectDto {
  @IsString()
  sejourId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParticipantDirectDto)
  participants!: ParticipantDirectDto[];
}
