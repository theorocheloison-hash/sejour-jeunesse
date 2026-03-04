import { IsEnum } from 'class-validator';
import { StatutSejour } from '@prisma/client';

export class UpdateStatusDto {
  @IsEnum(StatutSejour, { message: 'Statut invalide' })
  statut: StatutSejour;
}
