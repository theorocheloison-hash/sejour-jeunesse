import { Module } from '@nestjs/common';
import { InvitationController } from './invitation.controller.js';
import { InvitationService } from './invitation.service.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [EmailModule],
  controllers: [InvitationController],
  providers: [InvitationService],
  exports: [InvitationService],
})
export class InvitationModule {}
