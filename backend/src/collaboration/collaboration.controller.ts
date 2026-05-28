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
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
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
import { CentreId } from '../centres/centre-id.decorator.js';

@Controller('collaboration')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANISATEUR, Role.HEBERGEUR, Role.SIGNATAIRE)
export class CollaborationController {
  constructor(private readonly service: CollaborationService) {}

  // ── Route statique AVANT :sejourId ────────────────────────────

  @Get('mes-sejours')
  getMesSejoursConvention(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.service.getMesSejoursConvention(user.id, centreId);
  }

  @Get('mes-sejours-planning')
  getMesSejoursPlanning(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.service.getMesSejoursPlanning(user.id, centreId);
  }

  @Get('mes-non-lus')
  @Roles(Role.HEBERGEUR)
  getMesNonLus(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.service.getMesNonLus(user.id, centreId);
  }

  @Post('marquer-visite')
  @Roles(Role.HEBERGEUR)
  marquerVisite(
    @CurrentUser() user: JwtUser,
    @Body() body: { sejourId: string; onglet: string },
  ) {
    return this.service.marquerVisite(user.id, body.sejourId, body.onglet);
  }

  // ── Infos séjour ──────────────────────────────────────────────

  @Get(':sejourId')
  getSejourInfo(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getSejourInfo(sejourId, user.id, user.role);
  }

  @Patch(':sejourId/infos')
  @Roles(Role.HEBERGEUR)
  updateInfosSejour(
    @Param('sejourId') sejourId: string,
    @Body() body: { titre?: string; dateDebut?: string; dateFin?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.updateInfosSejour(sejourId, body, user.id);
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

  // ── Planning IA ───────────────────────────────────────────────

  @Post(':sejourId/planning/generer')
  genererPlanningIA(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
    @Body() body?: { debutActivites?: string; finActivites?: string },
  ) {
    return this.service.genererPlanningIA(sejourId, user.id, user.role, body?.debutActivites, body?.finActivites);
  }

  @Post(':sejourId/notifier-planning')
  @Roles(Role.HEBERGEUR)
  notifierPlanning(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.notifierPlanningMisAJour(sejourId, user.id);
  }

  @Get(':sejourId/planning/generer/:jobId')
  getPlanningGenerationStatus(
    @Param('sejourId') sejourId: string,
    @Param('jobId') jobId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getPlanningGenerationStatus(jobId, user.id, user.role);
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

  // ── Journal de séjour ─────────────────────────────────────────

  /** GET /collaboration/:sejourId/journal — Liste les posts (ORGANISATEUR, HEBERGEUR, SIGNATAIRE) */
  @Get(':sejourId/journal')
  getJournal(@Param('sejourId') sejourId: string, @CurrentUser() user: JwtUser) {
    return this.service.getJournal(sejourId, user.id, user.role);
  }

  /** POST /collaboration/:sejourId/journal — Créer un post + photos (ORGANISATEUR, HEBERGEUR) */
  @Post(':sejourId/journal')
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR)
  @UseInterceptors(FilesInterceptor('photos', 6))
  async createJournalPost(
    @Param('sejourId') sejourId: string,
    @Body('contenu') contenu: string,
    @UploadedFiles() photos: Express.Multer.File[],
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.createJournalPost(sejourId, user.id, user.role, contenu, photos ?? []);
  }

  /** DELETE /collaboration/:sejourId/journal/:postId — Supprimer un post (auteur seulement) */
  @Delete(':sejourId/journal/:postId')
  @Roles(Role.ORGANISATEUR, Role.HEBERGEUR)
  deleteJournalPost(
    @Param('sejourId') sejourId: string,
    @Param('postId') postId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.deleteJournalPost(sejourId, postId, user.id, user.role);
  }
}
