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

  // Lits inline à la création (saisie rapide) — une seule transaction.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => CreateLitDto)
  lits?: CreateLitDto[];
}
