import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { AbonnementService } from './abonnement.service.js';
import { SimulerAbonnementDto } from './dto/simuler-abonnement.dto.js';

@Controller('abonnements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbonnementController {
  constructor(private readonly abonnementService: AbonnementService) {}

  @Post('simuler')
  @Roles(Role.VENUE)
  simuler(@CurrentUser() user: JwtUser, @Body() dto: SimulerAbonnementDto) {
    return this.abonnementService.simuler(user.id, dto.type, dto.plan);
  }

  @Get('statut')
  @Roles(Role.VENUE)
  getStatut(@CurrentUser() user: JwtUser) {
    return this.abonnementService.getStatut(user.id);
  }
}
