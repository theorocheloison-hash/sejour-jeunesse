import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ReseauService } from './reseau.service.js';

@Controller('reseau')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RESEAU, Role.ADMIN)
export class ReseauController {
  constructor(private readonly reseauService: ReseauService) {}

  @Get('stats')
  getMyReseauStats(@Request() req: any, @Query('periode') periode?: string) {
    const reseau = req.user.reseauNom;
    if (!reseau) throw new Error('Compte réseau non configuré');
    return this.reseauService.getReseauStats(reseau, periode, req.user.reseauNomComplet);
  }

  @Get('demandes')
  getMyReseauDemandes(@Request() req: any, @Query('periode') periode?: string) {
    const reseau = req.user.reseauNom;
    if (!reseau) throw new Error('Compte réseau non configuré');
    return this.reseauService.getReseauDemandes(reseau, periode);
  }

  @Get('centres/:id')
  getCentreDetail(@Request() req: any, @Param('id') id: string) {
    const reseau = req.user.reseauNom;
    if (!reseau) throw new Error('Compte réseau non configuré');
    return this.reseauService.getReseauCentreDetail(id, reseau);
  }

  @Post('inviter')
  inviterCentre(@Request() req: any, @Body() body: { email: string; nomCentre: string }) {
    const reseau = req.user.reseauNom;
    if (!reseau) throw new Error('Compte réseau non configuré');
    return this.reseauService.inviterCentreReseau(reseau, body.email, body.nomCentre);
  }
}
