import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AbonnementController } from './abonnement.controller.js';
import { AbonnementWebhookController } from './webhook.controller.js';
import { AbonnementService } from './abonnement.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AbonnementController, AbonnementWebhookController],
  providers: [AbonnementService],
  exports: [AbonnementService],
})
export class AbonnementModule {}
