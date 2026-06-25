import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { AbonnementService } from './abonnement.service.js';
import { SimulerAbonnementDto } from './dto/simuler-abonnement.dto.js';
import { CheckoutAbonnementDto } from './dto/checkout-abonnement.dto.js';
import { CentreId } from '../centres/centre-id.decorator.js';

@Controller('abonnements')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AbonnementController {
  constructor(private readonly abonnementService: AbonnementService) {}

  @Post('simuler')
  @Roles(Role.HEBERGEUR)
  simuler(@CurrentUser() user: JwtUser, @Body() dto: SimulerAbonnementDto, @CentreId() centreId: string | null) {
    return this.abonnementService.simuler(user.id, dto.type, dto.plan, centreId);
  }

  @Get('statut')
  @Roles(Role.HEBERGEUR)
  getStatut(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.abonnementService.getStatut(user.id, centreId);
  }

  @Post('trial')
  @Roles(Role.HEBERGEUR)
  activerTrial(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.abonnementService.activerTrial(user.id, centreId);
  }

  @Post('checkout')
  @Roles(Role.HEBERGEUR)
  checkout(@CurrentUser() user: JwtUser, @Body() dto: CheckoutAbonnementDto, @CentreId() centreId: string | null) {
    return this.abonnementService.creerCheckout(user.id, dto.plan, dto.frequence, centreId);
  }

  @Post('annuler')
  @Roles(Role.HEBERGEUR)
  annuler(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.abonnementService.annuler(user.id, centreId);
  }
}
