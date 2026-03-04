import { Module } from '@nestjs/common';
import { HebergementController } from './hebergement.controller.js';
import { HebergementService } from './hebergement.service.js';

@Module({
  controllers: [HebergementController],
  providers: [HebergementService],
})
export class HebergementModule {}
