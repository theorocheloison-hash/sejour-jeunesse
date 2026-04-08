import { IsEmail, IsString, IsInt, IsOptional, Min, MinLength, IsDateString, IsArray, IsBoolean, IsNumber } from 'class-validator';

export class CreateInvitationCollaborationDto {
  @IsEmail({}, { message: 'Email invalide' })
  emailEnseignant: string;

  @IsString()
  @MinLength(1)
  titreSejourSuggere: string;

  @IsDateString()
  dateDebut: string;

  @IsDateString()
  dateFin: string;

  @IsInt()
  @Min(1)
  nbElevesEstime: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  nombreAccompagnateurs?: number;

  @IsOptional()
  @IsString()
  niveauClasse?: string;

  @IsOptional()
  @IsArray()
  thematiquesPedagogiques?: string[];

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
  transportSurPlace?: boolean;

  @IsOptional()
  @IsString()
  activitesSouhaitees?: string;

  @IsOptional()
  @IsNumber()
  budgetMaxParEleve?: number;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  etablissementUai?: string;

  @IsOptional()
  @IsString()
  etablissementNom?: string;

  @IsOptional()
  @IsString()
  etablissementAdresse?: string;

  @IsOptional()
  @IsString()
  etablissementVille?: string;
}
