import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

export class RegisterVenueDto {
  // ── Infos personnelles ──
  @IsString()
  prenom: string;

  @IsString()
  nom: string;

  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  // ── Infos du centre ──
  @IsString()
  nomCentre: string;

  @IsString()
  adresse: string;

  @IsString()
  ville: string;

  @IsString()
  codePostal: string;

  @IsInt()
  @Min(1, { message: 'La capacité doit être supérieure à 0' })
  capacite: number;

  @IsOptional()
  @IsString()
  description?: string;
}
