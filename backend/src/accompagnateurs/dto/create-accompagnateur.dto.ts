import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateAccompagnateurDto {
  @IsUUID()
  sejourId!: string;

  @IsString()
  @MinLength(1)
  prenom!: string;

  @IsString()
  @MinLength(1)
  nom!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  telephone?: string;
}
