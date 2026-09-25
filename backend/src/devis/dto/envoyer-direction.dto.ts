import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /devis/public/:token/envoyer-direction (public) et
 * POST /devis/:id/signature/envoyer-direction (connecté) — S1.
 * Messages en français : la page publique affiche le message backend verbatim.
 */
export class EnvoyerDirectionDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: "L'adresse email du destinataire est invalide." })
  @MaxLength(255, { message: "L'adresse email ne peut pas dépasser 255 caractères." })
  emailDirecteur!: string;

  @IsOptional()
  @IsString({ message: 'Le nom du destinataire doit être un texte.' })
  @MaxLength(255, { message: 'Le nom du destinataire ne peut pas dépasser 255 caractères.' })
  nomDirecteur?: string;
}
