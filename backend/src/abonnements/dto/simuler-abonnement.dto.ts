import { IsEnum } from 'class-validator';
import { TypeAbonnement } from '@prisma/client';

export class SimulerAbonnementDto {
  @IsEnum(TypeAbonnement)
  type: TypeAbonnement;
}
