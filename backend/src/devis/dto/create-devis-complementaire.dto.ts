import {
  IsArray,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LigneDevisDto } from './create-devis.dto.js';

export class CreateDevisComplementaireDto {
  @IsUUID()
  sejourDirectId!: string;

  @IsString()
  @MinLength(1)
  destinataireNom!: string;

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
  @IsEmail()
  destinataireEmail?: string;

  @IsOptional()
  @IsNumber()
  tauxTva?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  conditionsAnnulation?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LigneDevisDto)
  lignes!: LigneDevisDto[];
}
