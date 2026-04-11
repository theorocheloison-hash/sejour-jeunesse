import { Module } from '@nestjs/common';
import { InvitationsDirecteurController } from './invitations-directeur.controller.js';
import { InvitationsDirecteurService } from './invitations-directeur.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [InvitationsDirecteurController],
  providers: [InvitationsDirecteurService],
  exports: [InvitationsDirecteurService],
})
export class InvitationsDirecteurModule {}
