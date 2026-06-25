import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AbonnementController } from './abonnement.controller.js';
import { AbonnementWebhookController } from './webhook.controller.js';
import { AbonnementService } from './abonnement.service.js';
import { FactureLiavoModule } from '../facture-liavo/facture-liavo.module.js';

@Module({
  imports: [AuthModule, FactureLiavoModule],
  controllers: [AbonnementController, AbonnementWebhookController],
  providers: [AbonnementService],
  exports: [AbonnementService],
})
export class AbonnementModule {}
