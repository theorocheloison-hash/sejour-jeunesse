import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CapaciteController } from './capacite.controller.js';
import { CapaciteService } from './capacite.service.js';
import { ReferentielController } from './referentiel.controller.js';
import { ReferentielService } from './referentiel.service.js';

// Module chambres (Monde 1) — étage 1 : capacité globale + référentiel
// chambres/lits (sous-chantier 3). Le sous-chantier 4 (occupations, grille,
// sync) s'y logera.
@Module({
  imports: [AuthModule],
  controllers: [CapaciteController, ReferentielController],
  providers: [CapaciteService, ReferentielService],
  exports: [CapaciteService, ReferentielService],
})
export class ChambresModule {}
