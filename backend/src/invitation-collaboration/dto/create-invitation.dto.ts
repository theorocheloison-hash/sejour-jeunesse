import { IsEmail, IsString, IsInt, IsOptional, Min, MinLength, IsDateString } from 'class-validator';

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
  @IsString()
  message?: string;
}
