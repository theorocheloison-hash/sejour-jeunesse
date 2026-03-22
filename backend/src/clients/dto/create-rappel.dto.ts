import { IsOptional, IsString } from 'class-validator';

export class CreateRappelDto {
  @IsString() type!: string;
  @IsString() dateEcheance!: string;
  @IsString() description!: string;
  @IsOptional() @IsString() statut?: string;
}
