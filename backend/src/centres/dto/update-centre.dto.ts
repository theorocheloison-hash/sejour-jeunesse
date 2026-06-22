import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

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
  @IsString()
  departement?: string;

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
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim() && !/^https?:\/\//i.test(value)) {
      return `https://${value}`;
    }
    return value;
  })
  @Matches(/^https?:\/\//i, { message: 'Le site web doit commencer par http:// ou https://' })
  siteWeb?: string;

  @IsOptional()
  @IsString()
  siret?: string;

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
  @IsInt()
  @Type(() => Number)
  capaciteGroupeMin?: number;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  capaciteGroupeMax?: number;

  @IsOptional()
  @IsString()
  periodeOuverture?: string;
}
