import { Module } from '@nestjs/common';
import { SejourController } from './sejour.controller.js';
import { SejourService }    from './sejour.service.js';

@Module({
  controllers: [SejourController],
  providers:   [SejourService],
})
export class SejourModule {}
