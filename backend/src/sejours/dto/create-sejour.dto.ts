import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSejourDto {
  @IsString()
  @MinLength(1)
  titre: string;

  @IsOptional()
  @IsString()
  description?: string;

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
  villeHebergement: string;

  @IsString()
  @MinLength(1)
  niveauClasse: string;

  @IsArray()
  @IsString({ each: true })
  thematiquesPedagogiques: string[];

  @IsOptional()
  @IsString()
  regionSouhaitee?: string;

  @IsOptional()
  @IsDateString()
  dateButoireDevis?: string;
}
