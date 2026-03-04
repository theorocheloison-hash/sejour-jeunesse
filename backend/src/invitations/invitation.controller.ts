import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { InvitationService } from './invitation.service.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';

@Controller('invitations')
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.RECTOR, Role.DIRECTOR)
  create(@Body() dto: CreateInvitationDto) {
    return this.invitationService.create(dto);
  }

  @Get('accept/:token')
  accept(@Param('token') token: string) {
    return this.invitationService.findByToken(token);
  }
}
