import {
  Controller,
  Get,
  Query,
  Post,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { SearchOrganisationsDto } from './dto/search-organisations.dto.js';
import { OrganisationsService } from './organisations.service.js';
import { ClaimService } from './claim.service.js';

@Controller('organisations')
export class OrganisationsController {
  constructor(
    private readonly organisationsService: OrganisationsService,
    private readonly claimService: ClaimService,
  ) {}

  /**
   * Endpoint public d'autocomplete. Throttle 30/min/IP : avec un debounce
   * 300ms côté client une recherche typique consomme 3-5 req ; 10/min
   * saturait un user légitime.
   */
  @Get('search')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async search(@Query() dto: SearchOrganisationsDto) {
    const results = await this.organisationsService.searchExternal(dto.q);
    return { results };
  }

  /** GET /organisations/mon-claim-statut — État du claim en cours du User */
  @Get('mon-claim-statut')
  @UseGuards(JwtAuthGuard)
  async getMonClaimStatut(@CurrentUser() user: JwtUser) {
    return this.claimService.getMonClaimStatut(user.id);
  }

  /** POST /organisations/:id/claim — Initier un claim */
  @Post(':id/claim')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  async initierClaim(
    @Param('id') organisationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.claimService.initierClaim(user.id, organisationId, user.role);
  }

  /** POST /organisations/:id/upload-kbis — Upload Kbis PDF */
  @Post(':id/upload-kbis')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('file'))
  async uploadKbis(
    @Param('id') organisationId: string,
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.claimService.uploadKbis(user.id, organisationId, file);
  }
}
