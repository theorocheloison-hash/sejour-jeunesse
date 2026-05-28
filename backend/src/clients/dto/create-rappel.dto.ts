import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateRappelDto {
  @IsString() type!: string;
  @IsString() dateEcheance!: string;
  @IsString() description!: string;
  @IsOptional() @IsString() statut?: string;
  @IsOptional() @IsUUID() sejourId?: string;
}
