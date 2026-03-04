import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DemandeController } from './demande.controller.js';
import { DemandeService } from './demande.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DemandeController],
  providers: [DemandeService],
})
export class DemandeModule {}
