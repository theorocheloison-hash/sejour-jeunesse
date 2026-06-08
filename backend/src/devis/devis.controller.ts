import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { DevisService } from './devis.service.js';
import { CreateDevisDto } from './dto/create-devis.dto.js';
import { UpdateStatutDevisDto } from './dto/update-statut-devis.dto.js';
import { UpdateDevisDto } from './dto/update-devis.dto.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';

@Controller('devis')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
export class DevisController {
  constructor(private readonly devisService: DevisService) {}

  @Post()
  @Roles(Role.HEBERGEUR)
  @RequirePermission('devis')
  @UseInterceptors(FileInterceptor('file'))
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDevisDto,
    @CentreId() centreId: string | null,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.devisService.create(dto, user.id, file, centreId);
  }

  /** POST /devis/direct — Créer un devis sur séjour DIRECT */
  @Post('direct')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('devis')
  @UseInterceptors(FileInterceptor('file'))
  createDirect(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDevisDto,
    @CentreId() centreId: string | null,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.devisService.createDirectDevis(dto, user.id, file, centreId);
  }

  @Get('mes-devis')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('devis')
  getMesDevis(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.devisService.getMesDevis(user.id, centreId);
  }

  @Get('next-numero')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('devis')
  getNextNumeroDevis(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.devisService.getNextNumeroDevis(user.id, centreId);
  }

  @Get('a-valider')
  @Roles(Role.SIGNATAIRE)
  getDevisAValider() {
    return this.devisService.getDevisAValider();
  }

  @Get('factures-acompte')
  @Roles(Role.SIGNATAIRE)
  getFacturesAcompte() {
    return this.devisService.getFacturesAcompte();
  }

  @Get('demande/:demandeId')
  @Roles(Role.ORGANISATEUR, Role.SIGNATAIRE)
  getDevisForDemande(@CurrentUser() user: JwtUser, @Param('demandeId') demandeId: string) {
    return this.devisService.getDevisForDemande(demandeId, user);
  }

  @Get('demande-info/:demandeId')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('devis')
  getDemandeInfo(@CurrentUser() user: JwtUser, @Param('demandeId') demandeId: string, @CentreId() centreId: string | null) {
    return this.devisService.getDemandeInfo(demandeId, user.id, centreId);
  }

  @Get(':id/detail')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('devis')
  getDevisById(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
  ) {
    return this.devisService.getDevisById(id, user.id, centreId);
  }

  @Patch(':id')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('devis')
  @UseInterceptors(FileInterceptor('file'))
  updateDevis(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateDevisDto,
    @CentreId() centreId: string | null,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.devisService.updateDevis(id, dto, user.id, file, centreId);
  }

  @Post(':id/notifier-enseignant')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('devis')
  notifierEnseignant(
    @Param('id') id: string,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.devisService.notifierEnseignantModification(id, u.id, centreId);
  }

  @Post(':id/annuler')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('devis')
  annulerDevis(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
  ) {
    return this.devisService.annulerDevis(id, user.id, centreId);
  }

  @Patch(':id/statut')
  @Roles(Role.ORGANISATEUR, Role.SIGNATAIRE)
  updateStatut(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatutDevisDto,
  ) {
    return this.devisService.updateStatut(id, dto.statut, user.id, user.role);
  }

  @Patch(':id/signer')
  @Roles(Role.SIGNATAIRE)
  signerDevis(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.devisService.signerDevis(id, user, req.ip, req.headers['user-agent'] as string);
  }

  @Post(':id/upload-signature')
  @Roles(Role.ORGANISATEUR)
  @UseInterceptors(FileInterceptor('file'))
  uploadSignature(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.devisService.uploadSignatureDocument(id, user.id, file);
  }

  // ── Facturation migrée vers FactureModule (Lot 1) ──
  // Routes supprimées : PATCH facturer-acompte/facturer-solde/valider-acompte,
  // POST versements, PATCH versements/:vid/supprimer, GET chorus-xml.
  // Désormais : POST /factures/acompte, POST /factures/solde,
  // POST /factures/:id/versements, PATCH /factures/:id/valider-acompte, etc.

  /** POST /devis/:id/envoyer-direct — Envoyer un devis DIRECT par email */
  @Post(':id/envoyer-direct')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('devis')
  envoyerDirect(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
    @Body() body: { messagePersonnalise?: string },
  ) {
    return this.devisService.envoyerDevisDirect(id, user.id, centreId, body?.messagePersonnalise);
  }

  @Get(':id/versements')
  @Roles(Role.SIGNATAIRE, Role.HEBERGEUR)
  getVersements(@Param('id') id: string) {
    return this.devisService.getVersements(id);
  }
}
