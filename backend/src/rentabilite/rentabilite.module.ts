import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RentabiliteController } from './rentabilite.controller.js';
import { RentabiliteService } from './rentabilite.service.js';

@Module({
  imports: [AuthModule],
  controllers: [RentabiliteController],
  providers: [RentabiliteService],
  exports: [RentabiliteService],
})
export class RentabiliteModule {}
