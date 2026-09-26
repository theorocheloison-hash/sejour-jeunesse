import { Module } from '@nestjs/common';
import { AutorisationController } from './autorisation.controller.js';
import { AutorisationService } from './autorisation.service.js';
import { PurgeSanteService } from './purge-sante.service.js';

@Module({
  controllers: [AutorisationController],
  providers: [AutorisationService, PurgeSanteService],
})
export class AutorisationModule {}
