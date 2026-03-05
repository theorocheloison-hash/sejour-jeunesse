import { IsOptional, IsString } from 'class-validator';

export class UpdateEtablissementDto {
  @IsString()
  etablissementUai: string;

  @IsString()
  etablissementNom: string;

  @IsOptional()
  @IsString()
  etablissementAdresse?: string;

  @IsOptional()
  @IsString()
  etablissementVille?: string;

  @IsOptional()
  @IsString()
  etablissementEmail?: string;

  @IsOptional()
  @IsString()
  etablissementTelephone?: string;
}
