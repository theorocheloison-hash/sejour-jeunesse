import { Module } from '@nestjs/common';
import { SejourController } from './sejour.controller.js';
import { SejourService }    from './sejour.service.js';
import { ChambresModule } from '../chambres/chambres.module.js';

@Module({
  imports:     [ChambresModule],
  controllers: [SejourController],
  providers:   [SejourService],
})
export class SejourModule {}
