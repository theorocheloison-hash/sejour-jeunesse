import {
  IsString,
  IsEmail,
  IsOptional,
  IsInt,
  IsNumber,
  IsBoolean,
  IsArray,
  IsEnum,
  IsUUID,
  IsDateString,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TypeStructure } from '@prisma/client';

export class CreateDemandePubliqueDto {
  // ── Coordonnées (obligatoires) ──

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string;

  @IsEmail()
  email: string;

  // ── Établissement (optionnel) ──

  @IsOptional()
  @IsEnum(TypeStructure)
  typeStructure?: TypeStructure;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  etablissementNom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  etablissementVille?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  etablissementUai?: string;

  // ── Séjour (obligatoire : titre + nombreEleves) ──

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  titre: string;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  moisSouhaite?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2024)
  @Max(2035)
  anneeSouhaitee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  noteDateFlexible?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  dureeNuits?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  nombreEleves: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  niveauClasse?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  thematiquesPedagogiques?: string[];

  // ── Destination (optionnel) ──

  @IsOptional()
  @IsString()
  @MaxLength(200)
  regionCible?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  departementsCibles?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  typePension?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  villeHebergement?: string;

  @IsOptional()
  @IsUUID()
  centreDestinataireId?: string;

  @IsOptional()
  @IsDateString()
  dateButoireReponse?: string;

  // ── Détails logistiques (optionnel) ──

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(50)
  nombreAccompagnateurs?: number;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  heureArrivee?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  heureDepart?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  transportAller?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  transportSurPlace?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  activitesSouhaitees?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetMaxParEleve?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  informationsComplementaires?: string;

  // ── Hors scolaire / ACM (optionnel) ──

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  ageMin?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(99)
  ageMax?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  moinsde6ans?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  typeAccueilACM?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  projetEducatif?: string;

  // ── Tracking (optionnel) ──

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sourceReseau?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  telephone?: string;
}
