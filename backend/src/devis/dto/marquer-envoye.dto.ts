import { IsEmail, IsOptional } from 'class-validator';

/**
 * POST /devis/:id/marquer-envoye — trace d'envoi sans email (lien de signature
 * copié). Destinataire facultatif : le lien peut être remis hors email (main
 * propre, SMS…) ; s'il est fourni, il alimente dernierDestinataireEnvoi.
 */
export class MarquerEnvoyeDto {
  @IsOptional()
  @IsEmail()
  destinataire?: string;
}
