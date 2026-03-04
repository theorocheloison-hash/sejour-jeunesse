import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DevisController } from './devis.controller.js';
import { DevisService } from './devis.service.js';

@Module({
  imports: [AuthModule],
  controllers: [DevisController],
  providers: [DevisService],
})
export class DevisModule {}
