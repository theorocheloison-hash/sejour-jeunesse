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

@Controller('devis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevisController {
  constructor(private readonly devisService: DevisService) {}

  @Post()
  @Roles(Role.VENUE)
  @UseInterceptors(FileInterceptor('file'))
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDevisDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.devisService.create(dto, user.id, file);
  }

  @Get('mes-devis')
  @Roles(Role.VENUE)
  getMesDevis(@CurrentUser() user: JwtUser) {
    return this.devisService.getMesDevis(user.id);
  }

  @Get('next-numero')
  @Roles(Role.VENUE)
  getNextNumeroDevis(@CurrentUser() user: JwtUser) {
    return this.devisService.getNextNumeroDevis(user.id);
  }

  @Get('a-valider')
  @Roles(Role.DIRECTOR)
  getDevisAValider() {
    return this.devisService.getDevisAValider();
  }

  @Get('factures-acompte')
  @Roles(Role.DIRECTOR)
  getFacturesAcompte() {
    return this.devisService.getFacturesAcompte();
  }

  @Get('demande/:demandeId')
  @Roles(Role.TEACHER, Role.DIRECTOR)
  getDevisForDemande(@CurrentUser() user: JwtUser, @Param('demandeId') demandeId: string) {
    return this.devisService.getDevisForDemande(demandeId, user);
  }

  @Get('demande-info/:demandeId')
  @Roles(Role.VENUE)
  getDemandeInfo(@CurrentUser() user: JwtUser, @Param('demandeId') demandeId: string) {
    return this.devisService.getDemandeInfo(demandeId, user.id);
  }

  @Get(':id/detail')
  @Roles(Role.VENUE)
  getDevisById(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.devisService.getDevisById(id, user.id);
  }

  @Patch(':id')
  @Roles(Role.VENUE)
  @UseInterceptors(FileInterceptor('file'))
  updateDevis(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateDevisDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.devisService.updateDevis(id, dto, user.id, file);
  }

  @Patch(':id/statut')
  @Roles(Role.TEACHER, Role.DIRECTOR)
  updateStatut(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatutDevisDto,
  ) {
    return this.devisService.updateStatut(id, dto.statut, user.id, user.role);
  }

  @Patch(':id/signer')
  @Roles(Role.DIRECTOR)
  signerDevis(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    return this.devisService.signerDevis(id, user, req.ip, req.headers['user-agent'] as string);
  }

  @Patch(':id/facturer-acompte')
  @Roles(Role.VENUE)
  facturerAcompte(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.devisService.facturerAcompte(id, user.id);
  }

  @Patch(':id/facturer-solde')
  @Roles(Role.VENUE)
  facturerSolde(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.devisService.facturerSolde(id, user.id);
  }

  @Patch(':id/valider-acompte')
  @Roles(Role.DIRECTOR)
  validerAcompte(@Param('id') id: string) {
    return this.devisService.validerAcompte(id);
  }

  @Post(':id/versements')
  @Roles(Role.DIRECTOR, Role.VENUE)
  ajouterVersement(
    @Param('id') id: string,
    @Body() body: { montant: number; datePaiement: string; reference?: string },
  ) {
    return this.devisService.ajouterVersement(id, body.montant, body.datePaiement, body.reference);
  }

  @Get(':id/versements')
  @Roles(Role.DIRECTOR, Role.VENUE)
  getVersements(@Param('id') id: string) {
    return this.devisService.getVersements(id);
  }

  @Patch(':id/versements/:versementId/supprimer')
  @Roles(Role.DIRECTOR)
  supprimerVersement(
    @Param('id') id: string,
    @Param('versementId') versementId: string,
  ) {
    return this.devisService.supprimerVersement(versementId, id);
  }

  @Get(':id/chorus-xml')
  @Roles(Role.DIRECTOR, Role.VENUE)
  getChorusXml(@Param('id') id: string) {
    return this.devisService.getChorusXml(id);
  }
}
