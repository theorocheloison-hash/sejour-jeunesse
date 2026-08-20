import { Module } from '@nestjs/common';
import { EtablissementsController } from './etablissements.controller.js';
import { EtablissementsService } from './etablissements.service.js';

@Module({
  controllers: [EtablissementsController],
  providers: [EtablissementsService],
  exports: [EtablissementsService],
})
export class EtablissementsModule {}
