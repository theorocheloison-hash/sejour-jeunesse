import { Module } from '@nestjs/common';
import { SequenceModule } from '../sequence/sequence.module.js';
import { FactureLiavoService } from './facture-liavo.service.js';

@Module({
  imports: [SequenceModule],
  providers: [FactureLiavoService],
  exports: [FactureLiavoService],
})
export class FactureLiavoModule {}
