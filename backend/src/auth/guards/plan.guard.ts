import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PLAN_KEY, type PlanMetadata } from '../decorators/plan.decorator.js';
import type { JwtUser } from '../decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { getCentreForUser } from '../../centres/centre.helper.js';

const PLAN_HIERARCHY: Record<string, number> = {
  DECOUVERTE: 0,
  ESSENTIEL: 1,
  COMPLET: 2,
  PILOTAGE: 3,
};

const PLAN_LABELS: Record<string, string> = {
  ESSENTIEL: 'Essentiel',
  COMPLET: 'Complet',
  PILOTAGE: 'Pilotage',
};

@Injectable()
export class PlanGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Lire le plan requis depuis le decorator
    const meta = this.reflector.getAllAndOverride<PlanMetadata | undefined>(PLAN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!meta) return true;

    // 2. Récupérer le user
    const request = context.switchToHttp().getRequest();
    const user = request.user as JwtUser | undefined;
    if (!user) return true;

    // 3. Seuls les HEBERGEUR sont soumis au PlanGuard
    if (user.role !== 'HEBERGEUR') return true;

    // 4. Blocage souple : les lectures passent (sauf mode strict)
    if (!meta.strict) {
      const method = request.method?.toUpperCase();
      if (method === 'GET' || method === 'HEAD') return true;
    }

    // 5. Résoudre le centre
    const centreIdHeader = request.headers['x-centre-id'];
    const centreId = Array.isArray(centreIdHeader) ? centreIdHeader[0] : centreIdHeader;
    let centre: any;
    try {
      centre = await getCentreForUser(this.prisma, user.id, centreId || undefined);
    } catch {
      return true;
    }

    // 6. Calculer le plan effectif
    const exp = centre.abonnementActifJusquAu;
    const isActive = centre.abonnementStatut === 'ACTIF' && exp && new Date(exp) >= new Date();
    const effectivePlan = isActive ? (centre.planAbonnement ?? 'DECOUVERTE') : 'DECOUVERTE';

    // 7. Vérifier la hiérarchie
    const effectiveLevel = PLAN_HIERARCHY[effectivePlan] ?? 0;
    const requiredLevel = PLAN_HIERARCHY[meta.plan] ?? 0;

    if (effectiveLevel >= requiredLevel) return true;

    // 8. Bloquer
    throw new ForbiddenException({
      statusCode: 403,
      error: 'PLAN_INSUFFICIENT',
      planRequired: meta.plan,
      planActuel: effectivePlan,
      message: `Cette fonctionnalité nécessite le plan ${PLAN_LABELS[meta.plan] ?? meta.plan}.`,
    });
  }
}
