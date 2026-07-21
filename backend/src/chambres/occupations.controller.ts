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
import { OccupationsService } from './occupations.service.js';
import { CreateOccupationsDto } from './dto/create-occupations.dto.js';
import { UpdateOccupationDto } from './dto/update-occupation.dto.js';
import { CreateBlocagesDto } from './dto/create-blocages.dto.js';

/**
 * Occupations + grille + blocages (sous-chantier 4a). Permission `sejours`
 * (D5 : affectation chambres→séjour, PAS `parametres`), plan COMPLET (soft :
 * GET /grille passe, les mutations exigent COMPLET). Segments statiques
 * (`grille`, `occupations`, `blocages`) disjoints des routes `:id` du
 * référentiel — même préfixe `chambres`, aucune collision.
 */
@Controller('chambres')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard, PlanGuard)
@Roles(Role.HEBERGEUR)
@RequirePermission('sejours')
@RequirePlan('COMPLET')
export class OccupationsController {
  constructor(private readonly service: OccupationsService) {}

  @Get('grille')
  getGrille(
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
    @Query('debut') debut?: string,
    @Query('fin') fin?: string,
  ) {
    return this.service.getGrille(u.id, centreId, debut, fin);
  }

  @Post('occupations')
  createOccupations(
    @Body() dto: CreateOccupationsDto,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.createOccupations(dto, u.id, centreId);
  }

  @Patch('occupations/:id')
  updateOccupation(
    @Param('id') id: string,
    @Body() dto: UpdateOccupationDto,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.updateOccupation(id, dto, u.id, centreId);
  }

  @Delete('occupations/:id')
  deleteOccupation(
    @Param('id') id: string,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.deleteOccupation(id, u.id, centreId);
  }

  @Post('blocages')
  createBlocages(
    @Body() dto: CreateBlocagesDto,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.service.createBlocages(dto, u.id, centreId);
  }
}
