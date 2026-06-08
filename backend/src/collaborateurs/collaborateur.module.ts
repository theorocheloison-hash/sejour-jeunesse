import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CollaborateurController } from './collaborateur.controller.js';
import { CollaborateurService } from './collaborateur.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CollaborateurController],
  providers: [CollaborateurService],
  exports: [CollaborateurService],
})
export class CollaborateurModule {}
