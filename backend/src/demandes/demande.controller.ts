import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { DemandeService } from './demande.service.js';
import { CreateDemandeDto } from './dto/create-demande.dto.js';

@Controller('demandes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DemandeController {
  constructor(private readonly demandeService: DemandeService) {}

  @Post()
  @Roles(Role.TEACHER)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateDemandeDto) {
    return this.demandeService.create(dto, user.id);
  }

  @Get()
  @Roles(Role.VENUE)
  findOpen(@CurrentUser() user: JwtUser) {
    return this.demandeService.findOpen(user.id);
  }

  @Get('mes-demandes')
  @Roles(Role.TEACHER)
  getMesDemandes(@CurrentUser() user: JwtUser) {
    return this.demandeService.getMesDemandes(user.id);
  }

  @Get(':id')
  @Roles(Role.TEACHER, Role.VENUE, Role.DIRECTOR)
  findOne(@Param('id') id: string) {
    return this.demandeService.findOne(id);
  }

  @Get(':id/devis/comparatif')
  @Roles(Role.TEACHER, Role.DIRECTOR)
  getComparatif(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.demandeService.getComparatif(id, user);
  }
}
