import { Controller, Get, Param, Query } from '@nestjs/common';
import { EtablissementsService } from './etablissements.service.js';

@Controller('etablissements')
export class EtablissementsController {
  constructor(private readonly service: EtablissementsService) {}

  /** GET /etablissements/recherche?q=...&cp=... — Public, pas de JWT */
  @Get('recherche')
  rechercher(
    @Query('q') query?: string,
    @Query('cp') codePostal?: string,
  ) {
    return this.service.rechercher(query, codePostal);
  }

  /** GET /etablissements/:uai — Public */
  @Get(':uai')
  getById(@Param('uai') uai: string) {
    return this.service.getById(uai);
  }
}
