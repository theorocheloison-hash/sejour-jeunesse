import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DevisController } from './devis.controller.js';
import { DevisPublicController } from './devis-public.controller.js';
import { DevisService } from './devis.service.js';
import { ClientsModule } from '../clients/clients.module.js';
import { SequenceModule } from '../sequence/sequence.module.js';
import { ChambresModule } from '../chambres/chambres.module.js';

@Module({
  imports: [AuthModule, ClientsModule, SequenceModule, ChambresModule],
  controllers: [DevisController, DevisPublicController],
  providers: [DevisService],
})
export class DevisModule {}
