import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class SignerAutorisationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  taille?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  poids?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  pointure?: number;

  @IsOptional()
  @IsString()
  regimeAlimentaire?: string;

  @IsOptional()
  @IsString()
  niveauSki?: string;

  @IsOptional()
  @IsString()
  infosMedicales?: string;
}
