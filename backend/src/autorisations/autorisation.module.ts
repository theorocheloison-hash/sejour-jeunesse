import { Module } from '@nestjs/common';
import { AutorisationController } from './autorisation.controller.js';
import { AutorisationService } from './autorisation.service.js';

@Module({
  controllers: [AutorisationController],
  providers: [AutorisationService],
})
export class AutorisationModule {}
