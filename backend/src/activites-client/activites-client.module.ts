import { Module } from '@nestjs/common';
import { ActivitesClientController } from './activites-client.controller.js';
import { ActivitesClientService } from './activites-client.service.js';

@Module({
  controllers: [ActivitesClientController],
  providers: [ActivitesClientService],
  exports: [ActivitesClientService],
})
export class ActivitesClientModule {}
