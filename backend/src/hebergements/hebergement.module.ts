import { Module } from '@nestjs/common';
import { HebergementController } from './hebergement.controller.js';
import { HebergementService } from './hebergement.service.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [EmailModule],
  controllers: [HebergementController],
  providers: [HebergementService],
})
export class HebergementModule {}
