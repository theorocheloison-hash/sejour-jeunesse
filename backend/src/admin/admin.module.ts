import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrganisationsModule } from '../organisations/organisations.module.js';
import { InvitationModule } from '../invitations/invitation.module.js';
import { AbonnementModule } from '../abonnements/abonnement.module.js';
import { AdminController, ReseauController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [AuthModule, OrganisationsModule, InvitationModule, AbonnementModule],
  controllers: [AdminController, ReseauController],
  providers: [AdminService],
})
export class AdminModule {}
