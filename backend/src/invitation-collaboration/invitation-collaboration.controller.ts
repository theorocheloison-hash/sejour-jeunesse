import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { InvitationCollaborationService } from './invitation-collaboration.service.js';
import { CreateInvitationCollaborationDto } from './dto/create-invitation.dto.js';
import { InviterCentreExterneDto } from './dto/inviter-centre-externe.dto.js';

@Controller('invitation-collaboration')
export class InvitationCollaborationController {
  constructor(private readonly service: InvitationCollaborationService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  create(
    @Body() dto: CreateInvitationCollaborationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user);
  }

  @Post('centre-externe')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  inviterCentreExterne(
    @CurrentUser() user: JwtUser,
    @Body() dto: InviterCentreExterneDto,
  ) {
    return this.service.inviterCentreExterne(dto, user.id);
  }

  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.service.findByToken(token);
  }

  @Post(':token/accepter')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  accepter(
    @Param('token') token: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.accepter(token, user);
  }
}
