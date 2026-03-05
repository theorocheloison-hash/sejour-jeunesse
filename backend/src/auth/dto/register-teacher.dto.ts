import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  Matches,
} from 'class-validator';

export class RegisterTeacherDto {
  @IsString()
  prenom: string;

  @IsString()
  nom: string;

  @IsEmail({}, { message: 'Email invalide' })
  @Matches(
    /^[^@]+@(ac-[a-z-]+\.fr|education\.gouv\.fr)$/i,
    { message: 'Veuillez utiliser une adresse académique (@ac-*.fr ou @education.gouv.fr)' },
  )
  email: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password: string;

  @IsOptional()
  @IsString()
  telephone?: string;
}
