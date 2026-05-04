import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicService } from './public.service.js';
import { CentreService } from '../centres/centre.service.js';

@Controller('public')
export class PublicController {
  constructor(
    private readonly publicService: PublicService,
    private readonly centreService: CentreService,
  ) {}

  @Post('demande')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  soumettreDemandePublique(@Body() body: any) {
    return this.publicService.soumettreDemandePublique(body);
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
}
