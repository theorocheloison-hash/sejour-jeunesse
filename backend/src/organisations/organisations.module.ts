import { Module } from '@nestjs/common';
import { OrganisationsController } from './organisations.controller.js';
import { OrganisationsService } from './organisations.service.js';
import { ClaimService } from './claim.service.js';

@Module({
  controllers: [OrganisationsController],
  providers: [OrganisationsService, ClaimService],
  exports: [OrganisationsService, ClaimService],
})
export class OrganisationsModule {}
