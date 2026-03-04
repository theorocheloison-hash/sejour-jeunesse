import { IsEmail, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateAutorisationDto {
  @IsUUID()
  sejourId!: string;

  @IsString()
  @MinLength(1)
  eleveNom!: string;

  @IsString()
  @MinLength(1)
  elevePrenom!: string;

  @IsEmail()
  parentEmail!: string;
}
