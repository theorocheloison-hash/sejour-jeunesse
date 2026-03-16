import { Module } from '@nestjs/common';
import { InvitationCollaborationController } from './invitation-collaboration.controller.js';
import { InvitationCollaborationService } from './invitation-collaboration.service.js';

@Module({
  controllers: [InvitationCollaborationController],
  providers: [InvitationCollaborationService],
  exports: [InvitationCollaborationService],
})
export class InvitationCollaborationModule {}
