import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { ActivitesClientService, type CreateActiviteDto } from './activites-client.service.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';
import { PlanGuard } from '../auth/guards/plan.guard.js';
import { RequirePlan } from '../auth/decorators/plan.decorator.js';

@Controller('clients/:clientId/activites')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard, PlanGuard)
@Roles(Role.HEBERGEUR)
@RequirePlan('COMPLET')
export class ActivitesClientController {
  constructor(private readonly service: ActivitesClientService) {}

  @Get()
  @RequirePermission('crm')
  getActivites(@Param('clientId') clientId: string, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) {
    return this.service.getActivitesForUser(clientId, u.id, centreId);
  }

  @Post()
  @RequirePermission('crm')
  createActivite(
    @Param('clientId') clientId: string,
    @Body() dto: CreateActiviteDto,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.createActiviteManuelle(clientId, u.id, dto, centreId);
  }
}
