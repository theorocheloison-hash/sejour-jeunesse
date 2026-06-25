import { IsEnum, IsString } from 'class-validator';

export class CheckoutAbonnementDto {
  @IsString()
  plan: string; // ESSENTIEL | COMPLET | PILOTAGE

  @IsString()
  frequence: string; // MENSUEL | ANNUEL
}
