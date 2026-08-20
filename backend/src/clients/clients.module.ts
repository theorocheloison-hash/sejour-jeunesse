import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller.js';
import { ClientsService } from './clients.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EtablissementsModule } from '../etablissements/etablissements.module.js';

@Module({
  imports: [PrismaModule, EtablissementsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
