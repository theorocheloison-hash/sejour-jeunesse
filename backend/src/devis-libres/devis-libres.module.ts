import { Module } from '@nestjs/common';
import { DevisLibresController } from './devis-libres.controller.js';
import { DevisLibresService } from './devis-libres.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [PrismaModule, StorageModule, EmailModule],
  controllers: [DevisLibresController],
  providers: [DevisLibresService],
  exports: [DevisLibresService],
})
export class DevisLibresModule {}
