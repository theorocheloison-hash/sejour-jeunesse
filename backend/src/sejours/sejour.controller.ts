import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard }  from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard }    from '../auth/guards/roles.guard.js';
import { Roles }         from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { SejourService }    from './sejour.service.js';
import { CreateSejourDto }  from './dto/create-sejour.dto.js';
import { CreateSejourDirectDto } from './dto/create-sejour-direct.dto.js';
import { UpdateStatusDto }  from './dto/update-status.dto.js';
import { UpdateSejourDto }  from './dto/update-sejour.dto.js';
import { CentreId } from '../centres/centre-id.decorator.js';

@Controller('sejours')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SejourController {
  constructor(private readonly sejourService: SejourService) {}

  /** POST /sejours — Créer un séjour (ORGANISATEUR uniquement) */
  @Post()
  @Roles(Role.ORGANISATEUR)
  create(
    @Body() dto: CreateSejourDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.create(dto, user.id);
  }

  /** POST /sejours/depuis-catalogue — Créer séjour depuis fiche hébergeur */
  @Post('depuis-catalogue')
  @Roles(Role.ORGANISATEUR)
  creerDepuisCatalogue(
    @Body() dto: { centreId: string; titre: string; dateDebut: string; dateFin: string; nombreEleves: number; message?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.creerDepuisCatalogue(dto, user.id);
  }

  /** POST /sejours/direct — Créer un séjour en gestion directe (HEBERGEUR) */
  @Post('direct')
  @Roles(Role.HEBERGEUR)
  createDirect(
    @Body() dto: CreateSejourDirectDto,
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.sejourService.createDirect(dto, user.id, centreId);
  }

  /** DELETE /sejours/:id — Soft delete d'un séjour (HEBERGEUR) */
  @Delete(':id')
  @Roles(Role.HEBERGEUR)
  softDelete(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.sejourService.softDeleteSejour(id, user.id, centreId);
  }

  /** GET /sejours/me — Séjours de l'enseignant connecté */
  @Get('me')
  @Roles(Role.ORGANISATEUR)
  getMesSejours(@CurrentUser() user: JwtUser) {
    return this.sejourService.getMesSejours(user.id);
  }

  /** GET /sejours — Séjours par établissement (SIGNATAIRE) ou tous (AUTORITE) */
  @Get()
  @Roles(Role.SIGNATAIRE, Role.AUTORITE)
  findAll(@CurrentUser() user: JwtUser) {
    if (user.role === Role.SIGNATAIRE) {
      return this.sejourService.getAllSejoursSignataire(user.id, user.email);
    }
    return this.sejourService.findAll();
  }

  /** GET /sejours/:id/detail — Détail complet du séjour (directeur) */
  @Get(':id/detail')
  @Roles(Role.SIGNATAIRE)
  getSejourDetail(@Param('id') id: string) {
    return this.sejourService.getSejourDetail(id);
  }

  /** GET /sejours/:id/dossier-pedagogique — Données enrichies du séjour */
  @Get(':id/dossier-pedagogique')
  @Roles(Role.ORGANISATEUR, Role.SIGNATAIRE)
  getDossierPedagogique(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.getDossierPedagogique(id, user);
  }

  /** POST /sejours/:id/soumettre-directeur — Transmettre au directeur */
  @Post(':id/soumettre-directeur')
  @Roles(Role.ORGANISATEUR)
  soumettreAuDirecteur(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.soumettreAuDirecteur(id, user.id);
  }

  /** POST /sejours/:id/inviter-directeur — Inviter directeur (trouvé ou non) */
  @Post(':id/inviter-directeur')
  @Roles(Role.ORGANISATEUR)
  inviterDirecteur(
    @Param('id') id: string,
    @Body() body: { emailDirecteur?: string; devisId?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.inviterDirecteur(id, body.emailDirecteur, body.devisId, user.id);
  }

  /** POST /sejours/:id/soumettre-rectorat — Soumettre au rectorat (SIGNATAIRE) */
  @Post(':id/soumettre-rectorat')
  @Roles(Role.SIGNATAIRE)
  soumettreAuRectorat(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.soumettreAuRectorat(id, user.id);
  }

  /** POST /sejours/:id/declarer-tam — Déclarer un séjour HORS_SCOLAIRE en TAM */
  @Post(':id/declarer-tam')
  @Roles(Role.ORGANISATEUR)
  declarerTam(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.declarerTam(id, user.id);
  }

  /** GET /sejours/:id/accompagnateurs — Liste accompagnateurs */
  @Get(':id/accompagnateurs')
  @Roles(Role.ORGANISATEUR)
  getAccompagnateurs(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.getAccompagnateurs(id, user);
  }

  /** PATCH /sejours/:id/thematiques — Mettre à jour les thématiques pédagogiques */
  @Patch(':id/thematiques')
  @Roles(Role.ORGANISATEUR)
  updateThematiques(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { thematiques: string[] },
  ) {
    return this.sejourService.updateThematiques(id, user.id, body.thematiques);
  }

  /** PATCH /sejours/:id — Mettre à jour prix / dateLimiteInscription */
  @Patch(':id')
  @Roles(Role.ORGANISATEUR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSejourDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.update(id, dto, user.id);
  }

  /** PATCH /sejours/:id/status — Changer le statut */
  @Patch(':id/status')
  @Roles(Role.ORGANISATEUR, Role.SIGNATAIRE, Role.AUTORITE)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.sejourService.updateStatus(id, dto.statut, user);
  }
}
