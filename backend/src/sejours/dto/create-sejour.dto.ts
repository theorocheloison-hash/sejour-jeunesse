import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TypeContexteSejour } from '@prisma/client';

export enum TypeZone {
  FRANCE = 'FRANCE',
  REGION = 'REGION',
  DEPARTEMENT = 'DEPARTEMENT',
  VILLE = 'VILLE',
}

export class CreateSejourDto {
  @IsString()
  @MinLength(1)
  titre: string;

  @IsOptional()
  @IsString()
  informationsComplementaires?: string;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  moisSouhaite?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  anneeSouhaitee?: number;

  @IsOptional()
  @IsString()
  noteDateFlexible?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  dureeNuits?: number;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  nombreEleves: number;

  @IsOptional()
  @IsString()
  niveauClasse?: string;

  @IsArray()
  @IsString({ each: true })
  thematiquesPedagogiques: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  ageMax?: number;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  moinsde6ans?: boolean;

  @IsOptional()
  @IsString()
  typeAccueilACM?: string;

  @IsOptional()
  @IsString()
  projetEducatif?: string;

  @IsOptional()
  @IsEnum(TypeContexteSejour)
  typeContexte?: TypeContexteSejour;

  @IsEnum(TypeZone)
  typeZone: TypeZone;

  @IsString()
  @MinLength(1)
  zoneGeographique: string;

  @IsOptional()
  @IsDateString()
  dateButoireDevis?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  nombreAccompagnateurs?: number;

  @IsOptional()
  @IsString()
  heureArrivee?: string;

  @IsOptional()
  @IsString()
  heureDepart?: string;

  @IsOptional()
  @IsString()
  transportAller?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  transportSurPlace?: boolean;

  @IsOptional()
  @IsString()
  activitesSouhaitees?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetMaxParEleve?: number;
}
