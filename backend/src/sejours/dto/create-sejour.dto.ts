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

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  nombreEleves: number;

  @IsString()
  @MinLength(1)
  niveauClasse: string;

  @IsArray()
  @IsString({ each: true })
  thematiquesPedagogiques: string[];

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
  @IsBoolean()
  @Type(() => Boolean)
  transportDemande?: boolean;

  @IsOptional()
  @IsString()
  activitesSouhaitees?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetMaxParEleve?: number;
}
