import { SetMetadata } from '@nestjs/common';

export type PlanLevel = 'ESSENTIEL' | 'COMPLET' | 'PILOTAGE';

export interface PlanMetadata {
  plan: PlanLevel;
  strict: boolean;
}

export const PLAN_KEY = 'required_plan';

/**
 * @RequirePlan('PILOTAGE')             — soft : bloque POST/PATCH/PUT/DELETE, laisse passer GET
 * @RequirePlan('PILOTAGE', { strict: true }) — strict : bloque aussi les GET (analytics, exports)
 */
export function RequirePlan(plan: PlanLevel, options?: { strict?: boolean }) {
  const metadata: PlanMetadata = { plan, strict: options?.strict ?? false };
  return SetMetadata(PLAN_KEY, metadata);
}
