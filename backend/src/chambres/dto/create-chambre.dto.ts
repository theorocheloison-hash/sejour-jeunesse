import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateLitDto } from './create-lit.dto.js';

export class CreateChambreDto {
  @IsString() @Length(1, 100) nom!: string;
  @IsOptional() @IsString() @MaxLength(50) etage?: string;
  @IsOptional() @IsInt() ordre?: number;
  @IsOptional() @IsString() notes?: string;

  // Bornes défensives (saisie libre ouverte) — le DTO centre n'en a pas, choix 5.1.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  equipements?: string[];

  // Lits inline à la création (saisie rapide) — une seule transaction.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateLitDto)
  lits?: CreateLitDto[];
}
