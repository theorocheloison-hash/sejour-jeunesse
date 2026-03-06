import { Module } from '@nestjs/common';
import { AccompagnateurController } from './accompagnateur.controller.js';
import { AccompagnateurService } from './accompagnateur.service.js';

@Module({
  controllers: [AccompagnateurController],
  providers: [AccompagnateurService],
})
export class AccompagnateurModule {}
