import { IsString, MinLength } from 'class-validator';

export class RegisterCollaborateurDto {
  @IsString()
  token!: string;

  @IsString()
  prenom!: string;

  @IsString()
  nom!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
