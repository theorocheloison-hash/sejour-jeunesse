import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';
import { PlanGuard } from '../auth/guards/plan.guard.js';
import { RequirePlan } from '../auth/decorators/plan.decorator.js';
import { ReferentielService } from './referentiel.service.js';
import { CreateChambreDto } from './dto/create-chambre.dto.js';
import { UpdateChambreDto } from './dto/update-chambre.dto.js';
import { AjouterLitsDto } from './dto/ajouter-lits.dto.js';
import { UpdateLitDto } from './dto/update-lit.dto.js';
import { DupliquerChambreDto } from './dto/dupliquer-chambre.dto.js';

/**
 * Référentiel chambres/lits (sous-chantier 3). Permission `parametres` (D5),
 * plan COMPLET (décision Théo 21/07 — soft : la consultation passe, les
 * mutations exigent COMPLET ; seule l'alerte capacité étage 1 reste sans gate).
 * Même préfixe que CapaciteController, chemins disjoints.
 */
@Controller('chambres')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard, PlanGuard)
@Roles(Role.HEBERGEUR)
@RequirePermission('parametres')
@RequirePlan('COMPLET')
export class ReferentielController {
  constructor(private readonly service: ReferentielService) {}

  // ── Routes lits AVANT les routes :id (leçon « routes statiques en premier ») ──
  @Patch('lits/:litId')
  updateLit(
    @Param('litId') litId: string,
    @Body() dto: UpdateLitDto,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.updateLit(litId, dto, u.id, centreId);
  }

  @Delete('lits/:litId')
  deleteLit(
    @Param('litId') litId: string,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.deleteLit(litId, u.id, centreId);
  }

  // ── Chambres ─────────────────────────────────────────────────────────────
  @Get()
  getChambres(
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
    @Query('inactives') inactives?: string,
  ) {
    const inclureInactives = inactives === '1' || inactives === 'true';
    return this.service.getChambres(u.id, centreId, inclureInactives);
  }

  @Post()
  createChambre(
    @Body() dto: CreateChambreDto,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.createChambre(dto, u.id, centreId);
  }

  @Patch(':id')
  updateChambre(
    @Param('id') id: string,
    @Body() dto: UpdateChambreDto,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.updateChambre(id, dto, u.id, centreId);
  }

  @Delete(':id')
  deleteChambre(
    @Param('id') id: string,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.deleteChambre(id, u.id, centreId);
  }

  @Post(':id/dupliquer')
  dupliquerChambre(
    @Param('id') id: string,
    @Body() dto: DupliquerChambreDto,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.dupliquerChambre(id, dto.nombre ?? 1, u.id, centreId);
  }

  @Post(':id/lits')
  ajouterLits(
    @Param('id') id: string,
    @Body() dto: AjouterLitsDto,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.ajouterLits(id, dto.lits, u.id, centreId);
  }
}
