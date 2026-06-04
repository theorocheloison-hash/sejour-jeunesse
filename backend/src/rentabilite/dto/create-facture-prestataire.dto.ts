import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsUUID,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class VentilationDto {
  @IsUUID()
  sejourId: string;

  @IsNumber()
  @Min(0)
  montantTTC: number;
}

export class CreateFacturePrestatireDto {
  @IsString()
  @MaxLength(255)
  nomPrestataire: string;

  @IsString()
  @MaxLength(50)
  typeCharge: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroFacture?: string;

  @IsOptional()
  @IsString()
  dateFacture?: string; // ISO date string, converti en Date côté service

  @IsNumber()
  @Min(0)
  montantTotalTTC: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VentilationDto)
  ventilations: VentilationDto[]; // tableau vide autorisé (facture non encore ventilée)
}
