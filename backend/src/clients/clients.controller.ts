import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { ClientsService } from './clients.service.js';
import { CreateClientDto } from './dto/create-client.dto.js';
import { CreateContactDto } from './dto/create-contact.dto.js';
import { CreateRappelDto } from './dto/create-rappel.dto.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
@Roles(Role.HEBERGEUR)
@RequirePermission('crm')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}

  // ── Routes statiques en premier ──────────────────────────────────────────
  @Get('rappels/today')
  getRappelsToday(@CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.getRappelsToday(u.id, centreId); }

  @Get('search-etablissement')
  searchEtablissement(@Query('q') q: string) { return this.service.searchEtablissement(q ?? ''); }

  @Get()
  getMesClients(@CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.getMesClients(u.id, centreId); }

  @Post()
  createClient(@Body() dto: CreateClientDto, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.createClient(dto, u.id, centreId); }

  @Post('import/prospects')
  importerProspects(@Body() body: { academie: string; types: string[] }, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.importerProspects(body.academie, body.types ?? [], u.id, centreId); }

  @Post('import/csv')
  importerDepuisCSV(@Body() body: { lignes: Array<Record<string, string>> }, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.importerDepuisCSV(body.lignes, u.id, undefined, centreId); }

  @Post('import/contacts')
  importerContactsCSV(@Body() body: { lignes: Array<Record<string, string>> }, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.importerContactsCSV(body.lignes, u.id, centreId); }

  @Patch('contacts/:cid')
  updateContact(@Param('cid') cid: string, @Body() dto: Partial<CreateContactDto>, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.updateContact(cid, dto, u.id, centreId); }

  @Delete('contacts/:cid')
  deleteContact(@Param('cid') cid: string, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.deleteContact(cid, u.id, centreId); }

  @Patch('rappels/:rid/statut')
  updateRappelStatut(@Param('rid') rid: string, @Body() body: { statut: string }, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.updateRappelStatut(rid, body.statut, u.id, centreId); }

  @Delete('rappels/:rid')
  deleteRappel(@Param('rid') rid: string, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.deleteRappel(rid, u.id, centreId); }

  @Post(':id/envoyer-brochure')
  envoyerBrochure(@Param('id') id: string, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) {
    return this.service.envoyerBrochure(id, u.id, centreId);
  }

  // ── Routes paramétrées :id en dernier ────────────────────────────────────
  @Get(':id')
  getClient(@Param('id') id: string, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.getClient(id, u.id, centreId); }

  @Patch(':id')
  updateClient(@Param('id') id: string, @Body() dto: Partial<CreateClientDto>, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.updateClient(id, dto, u.id, centreId); }

  @Delete(':id')
  deleteClient(@Param('id') id: string, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.deleteClient(id, u.id, centreId); }

  @Post(':id/contacts')
  addContact(@Param('id') cid: string, @Body() dto: CreateContactDto, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.addContact(cid, dto, u.id, centreId); }

  @Post(':id/rappels')
  addRappel(@Param('id') cid: string, @Body() dto: CreateRappelDto, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.addRappel(cid, dto, u.id, centreId); }

  @Post(':id/sejours/:sejourId')
  rattacherSejour(@Param('id') cid: string, @Param('sejourId') sid: string, @CurrentUser() u: JwtUser, @CentreId() centreId: string | null) { return this.service.rattacherSejour(cid, sid, u.id, centreId); }
}
