import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SearchOrganisationsDto } from './dto/search-organisations.dto.js';
import { OrganisationsService } from './organisations.service.js';

@Controller('organisations')
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

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
}
