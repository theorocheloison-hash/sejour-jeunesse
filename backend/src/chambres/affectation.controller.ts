import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { RoomingService } from './rooming.service.js';

/**
 * Affectation participant→chambre (SC7 lot 2) — geste ORGANISATEUR sur SON
 * séjour (createurId). PAS de PermissionGuard/PlanGuard : ces guards sont
 * inopérants pour un organisateur (PlanGuard étape 3 laisse passer les
 * non-HEBERGEUR) — le plan COMPLET du centre est vérifié MANUELLEMENT dans le
 * service. Segments statiques `rooming`/`affectations` disjoints de
 * `rooming-stats`/`grille`/`occupations`/`blocages` ; le référentiel n'a pas
 * de GET :id → aucun ombrage.
 */
@Controller('chambres')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANISATEUR)
export class AffectationController {
  constructor(private readonly service: RoomingService) {}

  @Get('rooming')
  getRooming(@CurrentUser() u: JwtUser, @Query('sejourId') sejourId: string) {
    return this.service.getRooming(u.id, sejourId);
  }

  @Post('affectations')
  affecter(
    @Body()
    body: {
      sejourId: string;
      chambreId: string;
      autorisationId?: string;
      accompagnateurId?: string;
    },
    @CurrentUser() u: JwtUser,
  ) {
    return this.service.affecter(u.id, body.sejourId, body.chambreId, {
      autorisationId: body.autorisationId,
      accompagnateurId: body.accompagnateurId,
    });
  }

  @Delete('affectations/:id')
  retirer(@Param('id') id: string, @CurrentUser() u: JwtUser) {
    return this.service.retirer(u.id, id);
  }
}
