import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SequenceModule } from '../sequence/sequence.module.js';
import { FactureController } from './facture.controller.js';
import { FactureService } from './facture.service.js';

@Module({
  imports: [AuthModule, SequenceModule],
  controllers: [FactureController],
  providers: [FactureService],
  exports: [FactureService],
})
export class FactureModule {}
