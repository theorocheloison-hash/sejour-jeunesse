import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('hebergeurs')
  getHebergeurs(@Query('statut') statut?: string) {
    return this.adminService.getHebergeurs(statut);
  }

  @Patch('hebergeurs/:id/valider')
  validerHebergeur(@Param('id') id: string) {
    return this.adminService.validerHebergeur(id);
  }

  @Patch('hebergeurs/:id/refuser')
  refuserHebergeur(@Param('id') id: string, @Body('motif') motif?: string) {
    return this.adminService.refuserHebergeur(id, motif);
  }

  @Get('utilisateurs')
  getUtilisateurs(@Query('search') search?: string, @Query('role') role?: string) {
    return this.adminService.getUtilisateurs(search, role);
  }

  @Patch('utilisateurs/:id')
  updateUtilisateur(@Param('id') id: string, @Body() data: { role?: string; compteValide?: boolean }) {
    return this.adminService.updateUtilisateur(id, data);
  }

  @Get('centres')
  getCentres(@Query('search') search?: string) {
    return this.adminService.getCentres(search);
  }

  @Get('reseau/:reseau/stats')
  getReseauStats(@Param('reseau') reseau: string) {
    return this.adminService.getReseauStats(reseau);
  }

  @Patch('centres/:id/reseau')
  updateCentreReseau(@Param('id') id: string, @Body('reseau') reseau: string | null) {
    return this.adminService.updateCentreReseau(id, reseau);
  }
}

@Controller('reseau')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RESEAU, Role.ADMIN)
export class ReseauController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getMyReseauStats(@Request() req: any) {
    const reseau = req.user.reseauNom;
    if (!reseau) throw new Error('Compte réseau non configuré');
    return this.adminService.getReseauStats(reseau);
  }
}
