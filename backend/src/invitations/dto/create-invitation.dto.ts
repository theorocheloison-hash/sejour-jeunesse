import { IsEmail, IsInt, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString()
  @MinLength(1)
  nomCentre: string;

  @IsOptional()
  @IsUUID()
  centreExistantId?: string;

  @IsOptional()
  @IsString()
  centrePrecreerNom?: string;

  @IsOptional()
  @IsString()
  centrePrecreerAdresse?: string;

  @IsOptional()
  @IsString()
  centrePrecreerVille?: string;

  @IsOptional()
  @IsString()
  centrePrecreerCodePostal?: string;

  @IsOptional()
  @IsInt()
  centrePrecreerCapacite?: number;

  @IsOptional()
  @IsString()
  centrePrecreerSiret?: string;

  @IsOptional()
  @IsString()
  centrePrecreerDepartement?: string;
}
