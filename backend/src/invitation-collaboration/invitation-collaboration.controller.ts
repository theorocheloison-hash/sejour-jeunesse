import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { InvitationCollaborationService } from './invitation-collaboration.service.js';
import { CreateInvitationCollaborationDto } from './dto/create-invitation.dto.js';
import { InviterCentreExterneDto } from './dto/inviter-centre-externe.dto.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';

@Controller('invitation-collaboration')
export class InvitationCollaborationController {
  constructor(private readonly service: InvitationCollaborationService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('sejours')
  create(
    @Body() dto: CreateInvitationCollaborationDto,
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.create(dto, user, centreId);
  }

  @Post('centre-externe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  inviterCentreExterne(
    @CurrentUser() user: JwtUser,
    @Body() dto: InviterCentreExterneDto,
  ) {
    return this.service.inviterCentreExterne(dto, user.id);
  }

  // IMPÉRATIF : déclarée AVANT @Get(':token') — Nest matche dans l'ordre de
  // déclaration, déclarée après elle serait avalée par :token.
  @Get('pendantes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  getPendantes(@CurrentUser() user: JwtUser) {
    return this.service.getPendantesPourUser(user.id);
  }

  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.service.findByToken(token);
  }

  @Post(':token/accepter')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  accepter(
    @Param('token') token: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.accepter(token, user);
  }
}
