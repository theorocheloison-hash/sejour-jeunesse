import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard }    from '../auth/guards/roles.guard.js';
import { Roles }         from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { SejourService }    from './sejour.service.js';
import { CreateSejourDto }  from './dto/create-sejour.dto.js';
import { UpdateStatusDto }  from './dto/update-status.dto.js';

@Controller('sejours')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SejourController {
  constructor(private readonly sejourService: SejourService) {}

  /** POST /sejours — Créer un séjour (TEACHER uniquement) */
  @Post()
  @Roles(Role.TEACHER)
  create(
    @Body() dto: CreateSejourDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.create(dto, user.id);
  }

  /** GET /sejours/me — Séjours de l'enseignant connecté */
  @Get('me')
  @Roles(Role.TEACHER)
  getMesSejours(@CurrentUser() user: JwtUser) {
    return this.sejourService.getMesSejours(user.id);
  }

  /** GET /sejours — Tous les séjours (DIRECTOR, RECTOR) */
  @Get()
  @Roles(Role.DIRECTOR, Role.RECTOR)
  findAll() {
    return this.sejourService.findAll();
  }

  /** GET /sejours/:id/dossier-pedagogique — Données enrichies du séjour */
  @Get(':id/dossier-pedagogique')
  @Roles(Role.TEACHER, Role.DIRECTOR)
  getDossierPedagogique(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.getDossierPedagogique(id, user);
  }

  /** GET /sejours/:id/accompagnateurs — Liste accompagnateurs */
  @Get(':id/accompagnateurs')
  @Roles(Role.TEACHER)
  getAccompagnateurs(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.getAccompagnateurs(id, user);
  }

  /** PATCH /sejours/:id/status — Changer le statut */
  @Patch(':id/status')
  @Roles(Role.TEACHER, Role.DIRECTOR, Role.RECTOR)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.updateStatus(id, dto.statut, user);
  }
}
