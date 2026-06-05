import { IsString, IsOptional, IsDateString, IsEmail } from 'class-validator';

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
}
