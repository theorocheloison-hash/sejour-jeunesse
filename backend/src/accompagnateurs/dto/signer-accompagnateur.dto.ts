import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class SignerAccompagnateurDto {
  @IsOptional()
  @IsString()
  contactUrgenceNom?: string;

  @IsOptional()
  @IsString()
  contactUrgenceTel?: string;

  @IsString()
  signatureNom!: string;

  @IsOptional()
  @IsString()
  moyenTransport?: string;

  @IsBoolean()
  rgpdAccepte!: boolean;
}
