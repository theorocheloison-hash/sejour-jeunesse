import { IsEnum } from 'class-validator';
import { TypeAbonnement, PlanAbonnement } from '@prisma/client';

export class SimulerAbonnementDto {
  @IsEnum(TypeAbonnement)
  type: TypeAbonnement;

  @IsEnum(PlanAbonnement)
  plan: PlanAbonnement;
}
