import { Module } from '@nestjs/common';
import { CollaborationController } from './collaboration.controller.js';
import { CollaborationService } from './collaboration.service.js';
import { ChambresModule } from '../chambres/chambres.module.js';

@Module({
  // Lot 5 : OccupationsService pour la cascade de re-datage dans updateInfosSejour
  // (Email/Prisma/Storage sont @Global — ChambresModule est le seul import requis).
  imports: [ChambresModule],
  controllers: [CollaborationController],
  providers: [CollaborationService],
})
export class CollaborationModule {}
