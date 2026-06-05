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
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { AutorisationService, type ParticipantDirectInput } from './autorisation.service.js';
import { CreateAutorisationDto } from './dto/create-autorisation.dto.js';
import { SignerAutorisationDto } from './dto/signer-autorisation.dto.js';

@Controller('autorisations')
export class AutorisationController {
  constructor(private readonly autorisationService: AutorisationService) {}

  /** POST /autorisations/batch-direct — Création batch saisie directe (ORGANISATEUR) */
  @Post('batch-direct')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  batchDirect(
    @Body() body: { sejourId: string; participants: ParticipantDirectInput[] },
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.createBatchDirect(body.sejourId, body.participants, user.id);
  }

  /** POST /autorisations — Créer une autorisation (ORGANISATEUR) */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  create(
    @Body() dto: CreateAutorisationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.create(dto, user.id);
  }

  /** POST /autorisations/import-csv — Import CSV d'élèves (ORGANISATEUR) */
  @Post('import-csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  @UseInterceptors(FileInterceptor('file'))
  async importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    return this.autorisationService.importCsv(file, sejourId, user.id);
  }

  /** POST /autorisations/envoyer-invitations — Envoyer les emails d'invitation (ORGANISATEUR) */
  @Post('envoyer-invitations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  envoyerInvitations(
    @Body() body: { sejourId: string; autorisationIds?: string[] },
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.envoyerInvitations(body.sejourId, user.id, body.autorisationIds);
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

  /** PATCH /autorisations/:id/update-fields — Mise à jour saisie directe (ORGANISATEUR) */
  @Patch(':id/update-fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  updateFields(
    @Param('id') id: string,
    @Body() body: ParticipantDirectInput,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.updateFields(id, body, user.id);
  }

  /** DELETE /autorisations/:id — Supprimer un participant saisie directe (ORGANISATEUR) */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  deleteAutorisation(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.deleteAutorisation(id, user.id);
  }

  /** GET /autorisations/sejour/:sejourId — Liste des autorisations d'un séjour (ORGANISATEUR) */
  @Get('sejour/:sejourId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
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
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type?: string,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    return this.autorisationService.uploadDocumentMedical(token, file, type);
  }
}
