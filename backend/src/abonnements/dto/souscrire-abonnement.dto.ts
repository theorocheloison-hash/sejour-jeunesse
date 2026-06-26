import { IsBoolean, IsString, Matches, MinLength } from 'class-validator';

export class SouscrireAbonnementDto {
  @IsString()
  plan: string;

  @IsString()
  frequence: string;

  @IsString()
  @MinLength(15)
  @Matches(/^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/, { message: 'IBAN invalide' })
  iban: string;

  @IsString()
  @MinLength(2)
  titulaire: string;

  @IsBoolean()
  cgvAcceptee: boolean;
}
