import { IsString, IsOptional, IsDateString, IsEmail, IsInt, IsBoolean, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateInfosSejourDto {
  @IsOptional()
  @IsString()
  titre?: string;

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsOptional()
  @IsString()
  clientNom?: string;

  @IsOptional()
  @IsString()
  clientPrenom?: string;

  @IsOptional()
  @IsString()
  clientOrganisation?: string;

  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  clientTelephone?: string;

  @IsOptional()
  @IsString()
  clientAdresse?: string;

  @IsOptional()
  @IsString()
  clientCodePostal?: string;

  @IsOptional()
  @IsString()
  clientVille?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  placesTotales?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  nombreAccompagnateurs?: number;

  // ── Pense-bête détails séjour (qualification, saisie à la création) ──
  @IsOptional()
  @IsString()
  niveauClasse?: string;

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
  activitesSouhaitees?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  budgetMaxParEleve?: number;

  @IsOptional()
  @IsString()
  noteDateFlexible?: string;
}
