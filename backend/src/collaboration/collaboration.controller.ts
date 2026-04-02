import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';
import { CollaborationService } from './collaboration.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { CreatePlanningDto } from './dto/create-planning.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';

@Controller('collaboration')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.VENUE, Role.DIRECTOR)
export class CollaborationController {
  constructor(private readonly service: CollaborationService) {}

  // ── Route statique AVANT :sejourId ────────────────────────────

  @Get('mes-sejours')
  getMesSejoursConvention(@CurrentUser() user: JwtUser) {
    return this.service.getMesSejoursConvention(user.id);
  }

  // ── Infos séjour ──────────────────────────────────────────────

  @Get(':sejourId')
  getSejourInfo(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getSejourInfo(sejourId, user.id, user.role);
  }

  // ── Participants ─────────────────────────────────────────────

  @Get(':sejourId/participants')
  getParticipants(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getParticipants(sejourId, user.id, user.role);
  }

  // ── Budget ───────────────────────────────────────────────────

  @Get(':sejourId/budget')
  getBudgetData(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getBudgetData(sejourId, user.id, user.role);
  }

  @Post(':sejourId/budget/lignes-compl')
  addLigneCompl(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { categorie: string; description: string; montant: number },
  ) {
    return this.service.addLigneCompl(sejourId, user.id, body, user.role);
  }

  @Delete(':sejourId/budget/lignes-compl/:ligneId')
  deleteLigneCompl(
    @Param('sejourId') sejourId: string,
    @Param('ligneId') ligneId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.deleteLigneCompl(sejourId, user.id, ligneId, user.role);
  }

  @Post(':sejourId/budget/recettes')
  addRecette(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { source: string; montant: number },
  ) {
    return this.service.addRecette(sejourId, user.id, body, user.role);
  }

  @Delete(':sejourId/budget/recettes/:recetteId')
  deleteRecette(
    @Param('sejourId') sejourId: string,
    @Param('recetteId') recetteId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.deleteRecette(sejourId, user.id, recetteId, user.role);
  }

  // ── Messages ──────────────────────────────────────────────────

  @Get(':sejourId/messages')
  getMessages(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getMessages(sejourId, user.id, user.role);
  }

  @Post(':sejourId/messages')
  createMessage(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateMessageDto,
  ) {
    return this.service.createMessage(sejourId, user.id, dto, user.role);
  }

  // ── Planning ──────────────────────────────────────────────────

  @Get(':sejourId/planning')
  getPlanning(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getPlanning(sejourId, user.id, user.role);
  }

  @Post(':sejourId/planning')
  createPlanning(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePlanningDto,
  ) {
    return this.service.createPlanning(sejourId, user.id, dto, user.role);
  }

  @Delete(':sejourId/planning/:planningId')
  deletePlanning(
    @Param('sejourId') sejourId: string,
    @Param('planningId') planningId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.deletePlanning(sejourId, user.id, planningId, user.role);
  }

  @Get(':sejourId/activites-catalogue')
  getActivitesCatalogue(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getActivitesCatalogue(sejourId, user.id, user.role);
  }

  // ── Documents ─────────────────────────────────────────────────

  @Get(':sejourId/documents')
  getDocuments(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getDocuments(sejourId, user.id, user.role);
  }

  @Get(':sejourId/documents-centre')
  getDocumentsCentre(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getDocumentsCentre(sejourId, user.id, user.role);
  }

  @Post(':sejourId/documents')
  @UseInterceptors(FileInterceptor('file'))
  createDocument(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.service.createDocument(sejourId, user.id, dto, file, user.role);
  }

  // ── Contraintes séjour ────────────────────────────────────────

  @Get(':sejourId/contraintes')
  getContraintesSejour(@Param('sejourId') sejourId: string, @CurrentUser() user: JwtUser) {
    return this.service.getContraintesSejour(sejourId, user.id, user.role);
  }

  @Post(':sejourId/contraintes')
  createContrainteSejour(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: { libelle: string; type: string; date?: string; jourSemaine?: number; heureDebut?: string; heureFin?: string; produitId?: string },
  ) {
    return this.service.createContrainteSejour(sejourId, user.id, dto, user.role);
  }

  @Delete(':sejourId/contraintes/:contrainteId')
  deleteContrainteSejour(
    @Param('sejourId') sejourId: string,
    @Param('contrainteId') contrainteId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.deleteContrainteSejour(sejourId, user.id, contrainteId, user.role);
  }

  // ── Groupes séjour ────────────────────────────────────────────

  @Get(':sejourId/groupes')
  getGroupes(@Param('sejourId') sejourId: string, @CurrentUser() user: JwtUser) {
    return this.service.getGroupes(sejourId, user.id, user.role);
  }

  @Post(':sejourId/groupes/proposer')
  proposerGroupes(@Param('sejourId') sejourId: string, @CurrentUser() user: JwtUser) {
    return this.service.proposerGroupes(sejourId, user.id, user.role);
  }

  @Post(':sejourId/groupes')
  createGroupe(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: { nom: string; couleur: string; taille: number },
  ) {
    return this.service.createGroupe(sejourId, user.id, dto, user.role);
  }

  @Post(':sejourId/groupes/:groupeId/eleves/:autorisationId')
  affecterEleve(
    @Param('sejourId') sejourId: string,
    @Param('groupeId') groupeId: string,
    @Param('autorisationId') autorisationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.affecterEleve(sejourId, user.id, groupeId, autorisationId, user.role);
  }

  @Patch(':sejourId/groupes/:groupeId')
  updateGroupe(
    @Param('sejourId') sejourId: string,
    @Param('groupeId') groupeId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: { nom?: string; couleur?: string; taille?: number },
  ) {
    return this.service.updateGroupe(sejourId, user.id, groupeId, dto, user.role);
  }

  @Delete(':sejourId/groupes/eleves/:autorisationId')
  retirerEleve(
    @Param('sejourId') sejourId: string,
    @Param('autorisationId') autorisationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.retirerEleve(sejourId, user.id, autorisationId, user.role);
  }

  @Delete(':sejourId/groupes/:groupeId')
  deleteGroupe(
    @Param('sejourId') sejourId: string,
    @Param('groupeId') groupeId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.deleteGroupe(sejourId, user.id, groupeId, user.role);
  }

  @Post(':sejourId/cloturer-inscriptions')
  cloturerInscriptions(@Param('sejourId') sejourId: string, @CurrentUser() user: JwtUser) {
    return this.service.cloturerInscriptions(sejourId, user.id, user.role);
  }
}
