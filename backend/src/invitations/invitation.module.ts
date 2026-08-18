import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service.js';
import { EmailModule } from '../email/email.module.js';

// Plus de contrôleur : les routes publiques /invitations (POST + accept/:token)
// étaient un vestige sans appelant — le dashboard admin passe par
// /admin/invitations (AdminController consomme InvitationService exporté).
@Module({
  imports: [EmailModule],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
