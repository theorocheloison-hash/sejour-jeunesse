import { SetMetadata } from '@nestjs/common';

export type PlanLevel = 'ESSENTIEL' | 'COMPLET' | 'PILOTAGE';

export const PLAN_KEY = 'required_plan';
export const RequirePlan = (plan: PlanLevel) => SetMetadata(PLAN_KEY, plan);
