import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';
import { PlanGuard } from '../auth/guards/plan.guard.js';
import { RequirePlan } from '../auth/decorators/plan.decorator.js';
import { RoomingService } from './rooming.service.js';

/**
 * Rooming (SC7) — mêmes gardes de classe qu'OccupationsController (D5 :
 * permission `sejours`, plan COMPLET). Segment statique `rooming-stats`,
 * disjoint des routes existantes (`grille`, `occupations`, `blocages`, et le
 * référentiel n'a pas de GET :id) — aucune collision.
 */
@Controller('chambres')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard, PlanGuard)
@Roles(Role.HEBERGEUR)
@RequirePermission('sejours')
@RequirePlan('COMPLET')
export class RoomingController {
  constructor(private readonly service: RoomingService) {}

  @Get('rooming-stats')
  getRoomingStats(
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
    @Query('sejourId') sejourId: string,
  ) {
    return this.service.getRoomingStats(u.id, centreId, sejourId);
  }
}
