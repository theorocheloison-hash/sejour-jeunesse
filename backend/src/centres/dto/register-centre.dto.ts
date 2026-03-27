import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class RegisterCentreDto {
  @IsUUID()
  token: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password: string;

  @IsString()
  @MinLength(1)
  nom: string;

  @IsString()
  @MinLength(1)
  adresse: string;

  @IsString()
  @MinLength(1)
  ville: string;

  @IsString()
  @MinLength(1)
  codePostal: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacite: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  reseau?: string;
}
