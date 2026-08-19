import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { DemandeService } from './demande.service.js';
import { CreateDemandeDto } from './dto/create-demande.dto.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';

@Controller('demandes')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
export class DemandeController {
  constructor(private readonly demandeService: DemandeService) {}

  @Post()
  @Roles(Role.ORGANISATEUR)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateDemandeDto) {
    return this.demandeService.create(dto, user.id);
  }

  @Get()
  @Roles(Role.HEBERGEUR)
  findOpen(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.demandeService.findOpen(user.id, centreId);
  }

  @Get('mes-demandes')
  @Roles(Role.ORGANISATEUR)
  getMesDemandes(@CurrentUser() user: JwtUser) {
    return this.demandeService.getMesDemandes(user.id);
  }

  @Delete(':id/ignorer')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('devis')
  ignorerDemande(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
  ) {
    return this.demandeService.ignorerDemande(user.id, id, centreId);
  }

  @Get(':id')
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR, Role.SIGNATAIRE)
  findOne(@Param('id') id: string, @CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.demandeService.findOne(id, user, centreId);
  }

  @Get(':id/devis/comparatif')
  @Roles(Role.ORGANISATEUR, Role.SIGNATAIRE)
  getComparatif(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.demandeService.getComparatif(id, user);
  }
}
