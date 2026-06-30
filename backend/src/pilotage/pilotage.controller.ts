import { Controller, Get, Query, StreamableFile, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { PlanGuard } from '../auth/guards/plan.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { RequirePlan } from '../auth/decorators/plan.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { PilotageService } from './pilotage.service.js';

@Controller('pilotage')
@UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
@Roles(Role.HEBERGEUR)
export class PilotageController {
  constructor(private readonly service: PilotageService) {}

  /** GET /pilotage/remplissage?annee=2026 */
  @Get('remplissage')
  @RequirePlan('PILOTAGE', { strict: true })
  getRemplissage(
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
    @Query('annee') annee?: string,
  ) {
    const year = annee ? parseInt(annee, 10) : new Date().getFullYear();
    return this.service.getRemplissage(user.id, centreId, year);
  }

  /** GET /pilotage/ca?annee=2026 */
  @Get('ca')
  @RequirePlan('PILOTAGE', { strict: true })
  getCA(
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
    @Query('annee') annee?: string,
  ) {
    const year = annee ? parseInt(annee, 10) : new Date().getFullYear();
    return this.service.getCA(user.id, centreId, year);
  }

  /** GET /pilotage/export/factures?dateDebut=2026-01-01&dateFin=2026-12-31 */
  @Get('export/factures')
  @RequirePlan('COMPLET', { strict: true })
  async exportFactures(
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
    @Query('dateDebut') dateDebut: string,
    @Query('dateFin') dateFin: string,
  ) {
    const csv = await this.service.exportFacturesCSV(user.id, centreId, dateDebut, dateFin);
    const filename = `factures_LIAVO_${dateDebut}_${dateFin}.csv`;
    return new StreamableFile(Buffer.from(csv, 'utf-8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  /** GET /pilotage/export/versements?dateDebut=2026-01-01&dateFin=2026-12-31 */
  @Get('export/versements')
  @RequirePlan('COMPLET', { strict: true })
  async exportVersements(
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
    @Query('dateDebut') dateDebut: string,
    @Query('dateFin') dateFin: string,
  ) {
    const csv = await this.service.exportVersementsCSV(user.id, centreId, dateDebut, dateFin);
    const filename = `versements_LIAVO_${dateDebut}_${dateFin}.csv`;
    return new StreamableFile(Buffer.from(csv, 'utf-8'), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
