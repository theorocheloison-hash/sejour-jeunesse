import { Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';
import { CapaciteService } from './capacite.service.js';

/**
 * Alerte capacité globale (module chambres, étage 1 — D9/D10). Rôle HEBERGEUR,
 * permission `sejours`, centreId explicite via X-Centre-Id (getCentreForUser
 * dans le service). Pas de gate de plan : l'étage 1 protège les signatures,
 * ce n'est pas une feature Pilotage.
 */
@Controller('chambres')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
export class CapaciteController {
  constructor(private readonly capaciteService: CapaciteService) {}

  /** GET /chambres/alertes-capacite — alertes « option plus accueillable » (dashboard + page séjour) */
  @Get('alertes-capacite')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('sejours')
  getAlertes(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.capaciteService.getAlertes(user.id, centreId);
  }

  /** PATCH /chambres/alertes-capacite/:sejourId/acquitter — « j'ai prévenu le client » */
  @Patch('alertes-capacite/:sejourId/acquitter')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('sejours')
  acquitter(
    @CurrentUser() user: JwtUser,
    @Param('sejourId') sejourId: string,
    @CentreId() centreId: string | null,
  ) {
    return this.capaciteService.acquitter(sejourId, user.id, centreId);
  }
}
