import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AbonnementController } from './abonnement.controller.js';
import { AbonnementService } from './abonnement.service.js';

@Module({
  imports: [AuthModule],
  controllers: [AbonnementController],
  providers: [AbonnementService],
})
export class AbonnementModule {}
