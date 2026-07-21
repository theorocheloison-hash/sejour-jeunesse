import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CapaciteController } from './capacite.controller.js';
import { CapaciteService } from './capacite.service.js';

// Module chambres (Monde 1) — étage 1 : capacité globale. Les sous-chantiers 3
// (référentiel chambres/lits) et 4 (occupations, grille, sync) s'y logeront.
@Module({
  imports: [AuthModule],
  controllers: [CapaciteController],
  providers: [CapaciteService],
  exports: [CapaciteService],
})
export class ChambresModule {}
