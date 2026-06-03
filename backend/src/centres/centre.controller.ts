import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
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
import { CentreService } from './centre.service.js';
import { ClaimService } from '../organisations/claim.service.js';
import { RegisterCentreDto } from './dto/register-centre.dto.js';
import { UpdateCentreDto } from './dto/update-centre.dto.js';
import { CreateCentreDto } from './dto/create-centre.dto.js';
import { ClaimCentreDto } from './dto/claim-centre.dto.js';
import { CreateDisponibiliteDto } from './dto/create-disponibilite.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';
import { CentreId } from './centre-id.decorator.js';

@Controller('centres')
export class CentreController {
  constructor(
    private readonly centreService: CentreService,
    private readonly claimService: ClaimService,
  ) {}

  /**
   * POST /centres/claim-from-catalogue — Seul endpoint de revendication (HEBERGEUR).
   * Accepte un UUID Liavo ou un identifiant Éducation Nationale, avec justificatif
   * optionnel (multipart, champ `document`). Sans document → EN_ATTENTE_DOCUMENT.
   */
  @Post('claim-from-catalogue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('document'))
  claimFromCatalogue(
    @CurrentUser() user: JwtUser,
    @Body() dto: ClaimCentreDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    }
    return this.claimService.claimFromCatalogue(dto.catalogueId, user.id, user.role, file);
  }

  /** GET /centres/search-public?search=xxx — Recherche publique (pas d'auth) */
  @Get('search-public')
  searchPublic(@Query('search') search?: string) {
    return this.centreService.searchPublic(search ?? '');
  }

  /** GET /centres/mes-centres — Liste des centres de l'hébergeur connecté. MUST be before any :param route. */
  @Get('mes-centres')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getMesCentres(@CurrentUser() user: JwtUser) {
    return this.centreService.getMesCentres(user.id);
  }

  /** GET /centres/dashboard-global — KPIs consolidés multi-centre. MUST be before any :param route. */
  @Get('dashboard-global')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getDashboardGlobal(
    @CurrentUser() user: JwtUser,
    @Query('periodeDebut') periodeDebut?: string,
    @Query('periodeFin') periodeFin?: string,
  ) {
    return this.centreService.getDashboardGlobal(user.id, periodeDebut, periodeFin);
  }

  /** POST /centres — Créer un centre additionnel sur un compte HEBERGEUR existant. */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  createCentre(@CurrentUser() user: JwtUser, @Body() dto: CreateCentreDto) {
    return this.centreService.createCentre(user.id, dto);
  }

  /** GET /centres/admin/claims — Liste des claims en attente (admin). */
  @Get('admin/claims')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getClaimsPending() {
    return this.centreService.getClaimsPending();
  }

  /** PATCH /centres/admin/claims/:membershipId — Valider ou refuser un claim (admin). */
  @Patch('admin/claims/:membershipId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  validateClaim(
    @Param('membershipId') membershipId: string,
    @CurrentUser() admin: JwtUser,
    @Body() body: { action: 'VALIDE' | 'REFUSE'; raison?: string },
  ) {
    return this.centreService.validateClaim(membershipId, admin.id, body.action, body.raison);
  }

  /** GET /centres/admin/pending — Liste des centres en attente de validation (admin). */
  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getCentresPending() {
    return this.centreService.getCentresPending();
  }

  /** PATCH /centres/admin/pending/:centreId — Activer ou suspendre un centre PENDING (admin). */
  @Patch('admin/pending/:centreId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  validateCentrePending(
    @Param('centreId') centreId: string,
    @Body() body: { action: 'ACTIVE' | 'SUSPENDED' },
  ) {
    return this.centreService.validateCentrePending(centreId, body.action);
  }

  @Get('check-invitation/:token')
  async checkInvitation(@Param('token') token: string) {
    return this.centreService.checkInvitation(token);
  }

  @Post('register')
  register(@Body() dto: RegisterCentreDto) {
    return this.centreService.register(dto);
  }

  @Post('materialiser-en')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  materialiserCentreEN(@Body() body: {
    identifiantEN: string;
    nom: string;
    ville: string;
    codePostal: string;
    capacite: number;
    departement: string | null;
  }) {
    return this.centreService.materialiserCentreEN(body);
  }

  @Get('mon-profil')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getMonProfil(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.centreService.getMonProfil(user.id, centreId);
  }

  @Patch('mon-profil')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  updateMonProfil(@CurrentUser() user: JwtUser, @Body() dto: UpdateCentreDto, @CentreId() centreId: string | null) {
    return this.centreService.updateMonProfil(user.id, dto, centreId);
  }

  @Post('image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @CentreId() centreId: string | null,
  ) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.centreService.uploadImage(user.id, file, centreId);
  }

  @Post('brochure-upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('file'))
  uploadBrochure(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @CentreId() centreId: string | null,
  ) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.centreService.uploadBrochure(user.id, file, centreId);
  }

  @Post('documents-upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
    @CentreId() centreId: string | null,
  ) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.centreService.uploadDocument(user.id, file, dto, centreId);
  }

  @Patch('mandat-facturation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  accepterMandatFacturation(@CurrentUser() user: JwtUser, @Req() req: any, @CentreId() centreId: string | null) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;
    const ua = (req.headers['user-agent'] as string) ?? null;
    return this.centreService.accepterMandatFacturation(user.id, ip, ua, centreId);
  }

  @Get('disponibilites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getDisponibilites(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.centreService.getDisponibilites(user.id, centreId);
  }

  @Post('disponibilites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  createDisponibilite(@CurrentUser() user: JwtUser, @Body() dto: CreateDisponibiliteDto, @CentreId() centreId: string | null) {
    return this.centreService.createDisponibilite(user.id, dto, centreId);
  }

  @Delete('disponibilites/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  deleteDisponibilite(@CurrentUser() user: JwtUser, @Param('id') id: string, @CentreId() centreId: string | null) {
    return this.centreService.deleteDisponibilite(user.id, id, centreId);
  }

  @Get('documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getDocuments(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.centreService.getDocuments(user.id, centreId);
  }

  @Post('documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  createDocument(@CurrentUser() user: JwtUser, @Body() dto: CreateDocumentDto, @CentreId() centreId: string | null) {
    return this.centreService.createDocument(user.id, dto, centreId);
  }

  @Get('catalogue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getCatalogue(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.centreService.getProduitsCatalogue(user.id, centreId);
  }

  @Post('catalogue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  createProduit(
    @CurrentUser() user: JwtUser,
    @Body() dto: { nom: string; description?: string; type: string; prixUnitaireHT: number; prixUnitaireTTC?: number; tva: number; unite: string },
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.createProduit(user.id, dto, centreId);
  }

  @Post('catalogue/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  importProduits(
    @CurrentUser() user: JwtUser,
    @Body() body: { produits: { nom: string; description?: string; type: string; prixUnitaireHT: number; prixUnitaireTTC?: number; tva: number; unite: string }[] },
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.importProduits(user.id, body.produits, centreId);
  }

  @Patch('catalogue/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  updateProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { nom?: string; description?: string; type?: string; prixUnitaireHT?: number; prixUnitaireTTC?: number; tva?: number; unite?: string },
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.updateProduit(user.id, id, dto, centreId);
  }

  @Delete('catalogue/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  archiveProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.archiveProduit(user.id, id, centreId);
  }

  @Patch('catalogue/:id/capacites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  updateCapacitesProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { capaciteParGroupe?: number; encadrementParGroupe?: number; simultaneitePossible?: boolean; dureeMinutes?: number },
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.updateCapacitesProduit(user.id, id, dto, centreId);
  }

}
