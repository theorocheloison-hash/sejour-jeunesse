import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { PlanGuard } from '../auth/guards/plan.guard.js';
import { RequirePlan } from '../auth/decorators/plan.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { AutorisationService } from './autorisation.service.js';
import { CreateAutorisationDto } from './dto/create-autorisation.dto.js';
import { BatchDirectDto, ParticipantDirectDto } from './dto/participant-direct.dto.js';
import { SignerAutorisationDto } from './dto/signer-autorisation.dto.js';

@Controller('autorisations')
export class AutorisationController {
  constructor(private readonly autorisationService: AutorisationService) {}

  /** POST /autorisations/batch-direct — Création batch saisie directe (ORGANISATEUR, ou HEBERGEUR qui tient la main — Lot 6, B4) */
  @Post('batch-direct')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR)
  batchDirect(
    @Body() body: BatchDirectDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.createBatchDirect(body.sejourId, body.participants, user.id);
  }

  /** POST /autorisations — Créer une autorisation SANS envoi de mail (ORGANISATEUR).
   * D14 : l'ajout d'un élève n'envoie rien au parent ; l'envoi passe exclusivement
   * par POST /autorisations/envoyer-invitations (bouton « Envoyer aux familles »). */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  create(
    @Body() dto: CreateAutorisationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.createSansEmail(dto, user.id);
  }

  /** POST /autorisations/import-csv — Import CSV d'élèves (ORGANISATEUR, ou HEBERGEUR qui tient la main — Lot 6, B4) */
  @Post('import-csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    return this.autorisationService.importCsv(file, sejourId, user.id);
  }

  /** POST /autorisations/envoyer-invitations — Envoyer les emails d'invitation (ORGANISATEUR, ou HEBERGEUR en propre — B3a).
   * Côté HEBERGEUR : plan ESSENTIEL requis (même niveau que /sejours — un essai
   * expiré retombe en DECOUVERTE) ; le PlanGuard laisse passer l'ORGANISATEUR.
   * Le gate anti-phishing (centre non validé) est appliqué dans le service. */
  @Post('envoyer-invitations')
  @UseGuards(JwtAuthGuard, RolesGuard, PlanGuard)
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR)
  @RequirePlan('ESSENTIEL')
  envoyerInvitations(
    @Body() body: { sejourId: string; autorisationIds?: string[] },
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.envoyerInvitations(body.sejourId, user.id, body.autorisationIds);
  }

  /** POST /autorisations/sejour/:sejourId/envoyer-lien-journal — Envoyer le lien
   * personnel du journal à toutes les familles avec email (ORGANISATEUR, P10) */
  @Post('sejour/:sejourId/envoyer-lien-journal')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  envoyerLienJournal(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.envoyerLienJournal(sejourId, user.id);
  }

  /** PATCH /autorisations/:id/valider-paiement — Valider le paiement (ORGANISATEUR/SIGNATAIRE) */
  @Patch(':id/valider-paiement')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SIGNATAIRE, Role.ORGANISATEUR)
  validerPaiement(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.validerPaiement(id, user.id);
  }

  /** PATCH /autorisations/:id/valider-paiement-partiel — Enregistrer un versement partiel */
  @Patch(':id/valider-paiement-partiel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SIGNATAIRE, Role.ORGANISATEUR)
  validerPaiementPartiel(
    @Param('id') id: string,
    @Body() body: { montant: number },
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.validerPaiementPartiel(id, body.montant, user.id);
  }

  /** PATCH /autorisations/:id/update-fields — Mise à jour saisie directe (ORGANISATEUR, ou HEBERGEUR qui tient la main — Lot 6, B4) */
  @Patch(':id/update-fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR)
  updateFields(
    @Param('id') id: string,
    @Body() body: ParticipantDirectDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.updateFields(id, body, user.id);
  }

  /** PATCH /autorisations/:id/valider-signature — Marquer « papier signé reçu » (validation manuelle) */
  @Patch(':id/valider-signature')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR)
  validerSignatureManuelle(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.validerSignatureManuelle(id, user.id);
  }

  /** PATCH /autorisations/:id/annuler-signature — Annuler une validation manuelle (jamais une signature en ligne) */
  @Patch(':id/annuler-signature')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR)
  annulerSignatureManuelle(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.annulerSignatureManuelle(id, user.id);
  }

  /** PATCH /autorisations/valider-signatures — Marquer « papier signé reçu » en masse
   * (toutes les EN ATTENTE du séjour, ou la sélection autorisationIds) */
  @Patch('valider-signatures')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR)
  validerSignaturesBatch(
    @Body() body: { sejourId: string; autorisationIds?: string[] },
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.validerSignaturesBatch(body.sejourId, user.id, body.autorisationIds);
  }

  /** DELETE /autorisations/:id — Supprimer un participant saisie directe (ORGANISATEUR, ou HEBERGEUR qui tient la main — Lot 6, B4) */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR)
  deleteAutorisation(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.deleteAutorisation(id, user.id);
  }

  /** GET /autorisations/sejour/:sejourId — Liste des autorisations d'un séjour (ORGANISATEUR + HEBERGEUR lecture) */
  @Get('sejour/:sejourId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR)
  getBySejour(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.getBySejour(sejourId, user.id);
  }

  /** GET /autorisations/signer/:token — Infos publiques (PAS de guard) */
  @Get('signer/:token')
  getByToken(@Param('token') token: string) {
    return this.autorisationService.getByToken(token);
  }

  /** PATCH /autorisations/signer/:token — Signer (PAS de guard) */
  @Patch('signer/:token')
  signer(
    @Param('token') token: string,
    @Body() dto: SignerAutorisationDto,
    @Req() req: Request,
  ) {
    return this.autorisationService.signer(token, dto, req.ip);
  }

  /** POST /autorisations/:token/document — Upload document médical (PAS de guard) */
  @Post(':token/document')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadDocument(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type?: string,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    return this.autorisationService.uploadDocumentMedical(token, file, type);
  }
}
