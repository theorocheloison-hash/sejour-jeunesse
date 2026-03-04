import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateDevisDto {
  @IsUUID()
  demandeId: string;

  @IsString()
  @MinLength(1)
  montantTotal: string;

  @IsString()
  @MinLength(1)
  montantParEleve: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  conditionsAnnulation?: string;
}
