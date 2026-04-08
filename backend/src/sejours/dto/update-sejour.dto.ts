import { IsNumber, IsOptional, IsDateString, IsString, IsInt, IsBoolean, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSejourDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  prix?: number;

  @IsOptional()
  @IsDateString()
  dateLimiteInscription?: string;

  @IsOptional()
  @IsString()
  niveauClasse?: string;

  @IsOptional()
  @IsString()
  activitesSouhaitees?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetMaxParEleve?: number;

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
  informationsComplementaires?: string;
}
