import { IsEmail, IsOptional, IsUUID } from 'class-validator';

/** POST /sejours/:id/inviter-directeur — S1 (validation du body, messages FR). */
export class InviterDirecteurDto {
  @IsOptional()
  @IsEmail({}, { message: "L'adresse email du directeur est invalide." })
  emailDirecteur?: string;

  @IsOptional()
  @IsUUID(undefined, { message: "L'identifiant du devis est invalide." })
  devisId?: string;
}
