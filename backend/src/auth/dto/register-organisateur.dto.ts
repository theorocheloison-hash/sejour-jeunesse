import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { TypeStructure } from '@prisma/client';

export class RegisterOrganisateurDto {
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

  @IsOptional()
  @IsEnum(TypeStructure)
  typeStructure?: TypeStructure;

  @IsOptional()
  @IsUUID()
  accompagnateurToken?: string;
}
