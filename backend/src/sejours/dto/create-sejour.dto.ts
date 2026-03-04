import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
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
}
