import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EmailModule } from '../email/email.module.js';
import { DemandeController } from './demande.controller.js';
import { DemandeService } from './demande.service.js';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [DemandeController],
  providers: [DemandeService],
})
export class DemandeModule {}
