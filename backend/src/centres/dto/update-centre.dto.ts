import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCentreDto {
  @IsOptional()
  @IsString()
  nom?: string;

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  ville?: string;

  @IsOptional()
  @IsString()
  codePostal?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacite?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  siteWeb?: string;

  @IsOptional()
  @IsString()
  tvaIntracommunautaire?: string;

  @IsOptional()
  @IsString()
  iban?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipements?: string[];

  @IsOptional()
  @IsString()
  conditionsAnnulation?: string;

  @IsOptional()
  @IsBoolean()
  accessiblePmr?: boolean;

  @IsOptional()
  @IsString()
  avisSecurite?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  thematiquesCentre?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  activitesCentre?: string[];

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  capaciteAdultes?: number;

  @IsOptional()
  @IsString()
  periodeOuverture?: string;
}
