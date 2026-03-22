import { IsOptional, IsString } from 'class-validator';

export class CreateClientDto {
  @IsString() nom!: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() statut?: string;
  @IsOptional() @IsString() adresse?: string;
  @IsOptional() @IsString() ville?: string;
  @IsOptional() @IsString() codePostal?: string;
  @IsOptional() @IsString() telephone?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() uai?: string;
  @IsOptional() @IsString() academie?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() source?: string;
}
