import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicService } from './public.service.js';
import { CentreService } from '../centres/centre.service.js';
import { OrganisationsService } from '../organisations/organisations.service.js';
import { SearchOrganisationsDto } from '../organisations/dto/search-organisations.dto.js';
import { CreateDemandePubliqueDto } from './dto/create-demande-publique.dto.js';

@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly centreService: CentreService,
    private readonly organisationsService: OrganisationsService,
  ) {}

  @Post('demande')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  soumettreDemandePublique(@Body() dto: CreateDemandePubliqueDto) {
    return this.publicService.soumettreDemandePublique(dto);
  }

  @Get('centres')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  searchCentres(@Query('search') search?: string) {
    return this.centreService.searchPublic(search ?? '');
  }

  @Get('centres/:id')
  getCentrePublic(@Param('id') id: string) {
    return this.centreService.getPublic(id);
  }

  /**
   * Recherche SIRENE publique (sans auth) — réutilise EXACTEMENT la même méthode
   * de service que GET /organisations/search (zéro duplication de logique).
   * Sert l'autocomplete établissement de la page publique /appel-offres.
   */
  @Get('organisations/search')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async searchOrganisations(@Query() dto: SearchOrganisationsDto) {
    const results = await this.organisationsService.searchExternal(dto.q);
    return { results };
  }
}
