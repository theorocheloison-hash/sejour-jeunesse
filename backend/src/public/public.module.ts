import { Module } from '@nestjs/common';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EmailModule } from '../email/email.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CentreModule } from '../centres/centre.module.js';
import { OrganisationsModule } from '../organisations/organisations.module.js';

@Module({
  imports: [PrismaModule, EmailModule, AuthModule, CentreModule, OrganisationsModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
