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
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { setAuthCookies } from '../auth/auth-cookies.js';
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
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';

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
  @UseInterceptors(FileInterceptor('document', { limits: { fileSize: 10 * 1024 * 1024 } }))
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

  /** POST /centres/:id/upload-justificatif — Justificatif d'un centre PENDING (HEBERGEUR) */
  @Post(':id/upload-justificatif')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('document', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadJustificatif(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    }
    return this.centreService.uploadJustificatif(user.id, id, file!);
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

  /** GET /centres/mes-centres-pending — Centres de l'hébergeur en attente de validation. */
  @Get('mes-centres-pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getMesCentresPending(@CurrentUser() user: JwtUser) {
    return this.centreService.getMesCentresPending(user.id);
  }

  /** GET /centres/mes-permissions — Permissions de l'user sur le centre actif (multi-user). */
  @Get('mes-permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getMesPermissions(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.centreService.getMesPermissions(user.id, centreId);
  }

  /** GET /centres/onboarding-status — État d'onboarding du centre actif (dérivé, rien de stocké). */
  @Get('onboarding-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getOnboardingStatus(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.centreService.getOnboardingStatus(user.id, centreId);
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

  /** GET /centres/config-inscription — Config des champs d'inscription (HEBERGEUR). MUST be before any :param route. */
  @Get('config-inscription')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  getConfigInscription(
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.getConfigInscription(user.id, centreId);
  }

  /** PATCH /centres/config-inscription — Mise à jour de la config d'inscription (HEBERGEUR). */
  @Patch('config-inscription')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  updateConfigInscription(
    @CurrentUser() user: JwtUser,
    @Body() body: {
      champsActifs: string[];
      champsCustom: Array<{ nom: string; type: 'text' | 'number' | 'select'; obligatoire: boolean; options?: string[] }>;
    },
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.updateConfigInscription(user.id, body, centreId);
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
  async register(
    @Body() dto: RegisterCentreDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.centreService.register(dto);
    setAuthCookies(res, result.access_token, result.refresh_token);
    return result;
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
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  getMonProfil(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.centreService.getMonProfil(user.id, centreId);
  }

  @Patch('mon-profil')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  updateMonProfil(@CurrentUser() user: JwtUser, @Body() dto: UpdateCentreDto, @CentreId() centreId: string | null) {
    return this.centreService.updateMonProfil(user.id, dto, centreId);
  }

  @Post('image')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadImage(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @CentreId() centreId: string | null,
  ) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.centreService.uploadImage(user.id, file, centreId);
  }

  @Post('brochure-upload')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadBrochure(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @CentreId() centreId: string | null,
  ) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.centreService.uploadBrochure(user.id, file, centreId);
  }

  @Post('convention-pdf')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadConventionPdf(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.uploadConventionPdf(user.id, file, centreId);
  }

  @Post('convention-pdf/supprimer')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  supprimerConventionPdf(
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.supprimerConventionPdf(user.id, centreId);
  }

  @Post(':centreId/logo')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  uploadLogo(
    @CurrentUser() user: JwtUser,
    @Param('centreId') centreId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.centreService.uploadLogo(user.id, file, centreId);
  }

  @Delete(':centreId/logo')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  deleteLogo(
    @CurrentUser() user: JwtUser,
    @Param('centreId') centreId: string,
  ) {
    return this.centreService.deleteLogo(user.id, centreId);
  }

  @Post('documents-upload')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
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
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('planning')
  getDisponibilites(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.centreService.getDisponibilites(user.id, centreId);
  }

  @Post('disponibilites')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('planning')
  createDisponibilite(@CurrentUser() user: JwtUser, @Body() dto: CreateDisponibiliteDto, @CentreId() centreId: string | null) {
    return this.centreService.createDisponibilite(user.id, dto, centreId);
  }

  @Delete('disponibilites/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('planning')
  deleteDisponibilite(@CurrentUser() user: JwtUser, @Param('id') id: string, @CentreId() centreId: string | null) {
    return this.centreService.deleteDisponibilite(user.id, id, centreId);
  }

  @Get('documents')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  getDocuments(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.centreService.getDocuments(user.id, centreId);
  }

  @Post('documents')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  createDocument(@CurrentUser() user: JwtUser, @Body() dto: CreateDocumentDto, @CentreId() centreId: string | null) {
    return this.centreService.createDocument(user.id, dto, centreId);
  }

  @Get('catalogue')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  getCatalogue(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.centreService.getProduitsCatalogue(user.id, centreId);
  }

  @Post('catalogue')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  createProduit(
    @CurrentUser() user: JwtUser,
    @Body() dto: { nom: string; description?: string; type: string; prixUnitaireHT: number; prixUnitaireTTC?: number; tva: number; unite: string },
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.createProduit(user.id, dto, centreId);
  }

  @Post('catalogue/import')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  importProduits(
    @CurrentUser() user: JwtUser,
    @Body() body: { produits: { nom: string; description?: string; type: string; prixUnitaireHT: number; prixUnitaireTTC?: number; tva: number; unite: string }[] },
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.importProduits(user.id, body.produits, centreId);
  }

  @Patch('catalogue/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  updateProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { nom?: string; description?: string; type?: string; prixUnitaireHT?: number; prixUnitaireTTC?: number; tva?: number; unite?: string },
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.updateProduit(user.id, id, dto, centreId);
  }

  @Delete('catalogue/:id')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  archiveProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.archiveProduit(user.id, id, centreId);
  }

  @Patch('catalogue/:id/capacites')
  @UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
  @Roles(Role.HEBERGEUR)
  @RequirePermission('parametres')
  updateCapacitesProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { capaciteParGroupe?: number; encadrementParGroupe?: number; simultaneitePossible?: boolean; dureeMinutes?: number },
    @CentreId() centreId: string | null,
  ) {
    return this.centreService.updateCapacitesProduit(user.id, id, dto, centreId);
  }

}
