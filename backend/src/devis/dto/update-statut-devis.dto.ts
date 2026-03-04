import { IsEnum } from 'class-validator';
import { StatutDevis } from '@prisma/client';

export class UpdateStatutDevisDto {
  @IsEnum(StatutDevis)
  statut: StatutDevis;
}
