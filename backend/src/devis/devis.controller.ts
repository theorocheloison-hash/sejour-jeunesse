import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { DevisService } from './devis.service.js';
import { CreateDevisDto } from './dto/create-devis.dto.js';
import { UpdateStatutDevisDto } from './dto/update-statut-devis.dto.js';

@Controller('devis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevisController {
  constructor(private readonly devisService: DevisService) {}

  @Post()
  @Roles(Role.VENUE)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateDevisDto) {
    return this.devisService.create(dto, user.id);
  }

  @Get('mes-devis')
  @Roles(Role.VENUE)
  getMesDevis(@CurrentUser() user: JwtUser) {
    return this.devisService.getMesDevis(user.id);
  }

  @Get('demande/:demandeId')
  @Roles(Role.TEACHER, Role.DIRECTOR)
  getDevisForDemande(@CurrentUser() user: JwtUser, @Param('demandeId') demandeId: string) {
    return this.devisService.getDevisForDemande(demandeId, user);
  }

  @Patch(':id/statut')
  @Roles(Role.TEACHER)
  updateStatut(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatutDevisDto,
  ) {
    return this.devisService.updateStatut(id, dto.statut, user.id);
  }
}
