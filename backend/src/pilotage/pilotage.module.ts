import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { PilotageController } from './pilotage.controller.js';
import { PilotageService } from './pilotage.service.js';

@Module({
  imports: [AuthModule],
  controllers: [PilotageController],
  providers: [PilotageService],
})
export class PilotageModule {}
