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

@Controller('devis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevisController {
  constructor(private readonly devisService: DevisService) {}

  @Post()
  @Roles(Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('file'))
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDevisDto,
    @CentreId() centreId: string | null,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.devisService.create(dto, user.id, file, centreId);
  }

  @Get('mes-devis')
  @Roles(Role.HEBERGEUR)
  getMesDevis(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.devisService.getMesDevis(user.id, centreId);
  }

  @Get('next-numero')
  @Roles(Role.HEBERGEUR)
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
  getDemandeInfo(@CurrentUser() user: JwtUser, @Param('demandeId') demandeId: string, @CentreId() centreId: string | null) {
    return this.devisService.getDemandeInfo(demandeId, user.id, centreId);
  }

  @Get(':id/detail')
  @Roles(Role.HEBERGEUR)
  getDevisById(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
  ) {
    return this.devisService.getDevisById(id, user.id, centreId);
  }

  @Patch(':id')
  @Roles(Role.HEBERGEUR)
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
  notifierEnseignant(
    @Param('id') id: string,
    @CurrentUser() u: JwtUser,
    @CentreId() centreId: string | null,
  ) {
    return this.devisService.notifierEnseignantModification(id, u.id, centreId);
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

  @Patch(':id/facturer-acompte')
  @Roles(Role.HEBERGEUR)
  facturerAcompte(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
  ) {
    return this.devisService.facturerAcompte(id, user.id, centreId);
  }

  @Patch(':id/facturer-solde')
  @Roles(Role.HEBERGEUR)
  facturerSolde(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
  ) {
    return this.devisService.facturerSolde(id, user.id, centreId);
  }

  @Patch(':id/valider-acompte')
  @Roles(Role.SIGNATAIRE, Role.HEBERGEUR)
  validerAcompte(@Param('id') id: string) {
    return this.devisService.validerAcompte(id);
  }

  @Post(':id/versements')
  @Roles(Role.SIGNATAIRE, Role.HEBERGEUR)
  ajouterVersement(
    @Param('id') id: string,
    @Body() body: { montant: number; datePaiement: string; reference?: string },
  ) {
    return this.devisService.ajouterVersement(id, body.montant, body.datePaiement, body.reference);
  }

  @Get(':id/versements')
  @Roles(Role.SIGNATAIRE, Role.HEBERGEUR)
  getVersements(@Param('id') id: string) {
    return this.devisService.getVersements(id);
  }

  @Patch(':id/versements/:versementId/supprimer')
  @Roles(Role.SIGNATAIRE)
  supprimerVersement(
    @Param('id') id: string,
    @Param('versementId') versementId: string,
  ) {
    return this.devisService.supprimerVersement(versementId, id);
  }

  @Get(':id/chorus-xml')
  @Roles(Role.SIGNATAIRE, Role.HEBERGEUR)
  getChorusXml(@Param('id') id: string) {
    return this.devisService.getChorusXml(id);
  }
}
