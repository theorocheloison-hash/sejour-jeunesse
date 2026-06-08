import {
  IsString,
  IsOptional,
  IsDateString,
  IsInt,
  IsEmail,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSejourDirectDto {
  @IsString()
  @MinLength(1)
  titre!: string;

  @IsString()
  natureSejour!: string; // "SEJOUR" | "EVENEMENT"

  @IsOptional()
  @IsString()
  typeSejour?: string; // sous-type (CLASSE_DECOUVERTE, MARIAGE, etc.)

  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  nombreParticipants!: number;

  @IsOptional()
  @IsString()
  clientNom?: string;

  @IsOptional()
  @IsString()
  clientPrenom?: string;

  @IsOptional()
  @IsEmail()
  clientEmail?: string;

  @IsOptional()
  @IsString()
  clientTelephone?: string;

  @IsOptional()
  @IsString()
  clientOrganisation?: string;

  @IsOptional()
  @IsUUID()
  clientOrganisationId?: string;

  // Client CRM existant : si fourni, le séjour est lié directement (pas de client fantôme créé).
  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  clientAdresse?: string;

  @IsOptional()
  @IsString()
  clientCodePostal?: string;

  @IsOptional()
  @IsString()
  clientVille?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
