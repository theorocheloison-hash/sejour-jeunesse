import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { OrganisationsModule } from '../organisations/organisations.module.js';
import { InvitationModule } from '../invitations/invitation.module.js';
import { AbonnementModule } from '../abonnements/abonnement.module.js';
import { FactureLiavoModule } from '../facture-liavo/facture-liavo.module.js';
import { ReseauModule } from '../reseau/reseau.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [AuthModule, OrganisationsModule, InvitationModule, AbonnementModule, FactureLiavoModule, ReseauModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
