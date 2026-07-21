import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CapaciteController } from './capacite.controller.js';
import { CapaciteService } from './capacite.service.js';
import { ReferentielController } from './referentiel.controller.js';
import { ReferentielService } from './referentiel.service.js';
import { OccupationsController } from './occupations.controller.js';
import { OccupationsService } from './occupations.service.js';

// Module chambres (Monde 1) — étage 1 : capacité globale + référentiel
// chambres/lits (sous-chantier 3) + occupations/grille/sync (sous-chantier 4a).
// OccupationsService est exporté pour les sites de transition devis/séjour
// (syncOccupationsSejourSafe — §3.1 du plan 4a).
@Module({
  imports: [AuthModule],
  controllers: [CapaciteController, ReferentielController, OccupationsController],
  providers: [CapaciteService, ReferentielService, OccupationsService],
  exports: [CapaciteService, ReferentielService, OccupationsService],
})
export class ChambresModule {}
