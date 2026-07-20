import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { AdminService } from './admin.service.js';
import { ClaimService } from '../organisations/claim.service.js';
import { InvitationService } from '../invitations/invitation.service.js';
import { CreateInvitationDto } from '../invitations/dto/create-invitation.dto.js';
import { CronAlertesService } from '../abonnements/cron-alertes.service.js';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly claimService: ClaimService,
    private readonly invitationService: InvitationService,
    private readonly cronAlertesService: CronAlertesService,
  ) {}

  @Get('stats')
  getStats() {
    return this.adminService.getStats();
  }

  @Get('hebergeurs')
  getHebergeurs(@Query('statut') statut?: string) {
    return this.adminService.getHebergeurs(statut);
  }

  @Patch('hebergeurs/:id/valider')
  validerHebergeur(@Param('id') id: string) {
    return this.adminService.validerHebergeur(id);
  }

  @Patch('hebergeurs/:id/refuser')
  refuserHebergeur(@Param('id') id: string, @Body('motif') motif?: string) {
    return this.adminService.refuserHebergeur(id, motif);
  }

  @Get('utilisateurs')
  getUtilisateurs(@Query('search') search?: string, @Query('role') role?: string) {
    return this.adminService.getUtilisateurs(search, role);
  }

  @Patch('utilisateurs/:id')
  updateUtilisateur(@Param('id') id: string, @Body() data: { role?: string; compteValide?: boolean }) {
    return this.adminService.updateUtilisateur(id, data);
  }

  @Get('centres')
  getCentres(@Query('search') search?: string) {
    return this.adminService.getCentres(search);
  }

  @Get('abonnements')
  getAbonnements() {
    return this.adminService.getAbonnements();
  }

  @Get('factures-liavo')
  getFacturesLiavo() {
    return this.adminService.getFacturesLiavo();
  }

  @Get('metriques-abonnements')
  getMetriquesAbonnements() {
    return this.adminService.getMetriquesAbonnements();
  }

  @Get('activite')
  getActivite() {
    return this.adminService.getActivite();
  }

  @Post('facturer-centre')
  facturerCentre(@Body() body: {
    centreId: string;
    plan: string;
    frequence: string;
    destinataireNom?: string;
    destinataireAdresse?: string;
    destinataireSiret?: string;
    destinataireEmail?: string;
  }) {
    return this.adminService.facturerCentre(body);
  }

  @Post('devis-liavo')
  genererDevisLiavo(@Body() body: {
    centreId: string;
    plan: string;
    frequence: string;
    destinataireNom: string;
    destinataireAdresse?: string;
    destinataireSiret?: string;
    destinataireEmail?: string;
  }) {
    return this.adminService.genererDevisLiavo(body);
  }

  @Post('cron/alertes-expiration')
  async cronAlertes() {
    const alertes = await this.cronAlertesService.envoyerAlertes();
    const expires = await this.cronAlertesService.envoyerAlertesExpires();
    const renouvellements = await this.cronAlertesService.envoyerAlertesRenouvellement();
    return { ...alertes, ...expires, ...renouvellements };
  }

  @Get('reseau/:reseau/stats')
  getReseauStats(@Param('reseau') reseau: string) {
    return this.adminService.getReseauStats(reseau);
  }

  @Post('reseau/:reseau/sync-apidae')
  syncApidae(@Param('reseau') reseau: string) {
    return this.adminService.syncApidae(reseau);
  }

  @Post('reseau/:reseau/bulk-invite-apidae')
  bulkInviteApidae(@Param('reseau') reseau: string) {
    return this.adminService.bulkInviteApidae(reseau);
  }

  /** POST /admin/reseau/:reseau/backfill-en?dry=1 — Rattache les centres LMDJ à leur fiche EN (apidaeId) + enrichit les champs vides. dry=1 : matching seul, aucune écriture. */
  @Post('reseau/:reseau/backfill-en')
  backfillEducationNationale(@Param('reseau') reseau: string, @Query('dry') dry?: string) {
    return this.adminService.backfillEducationNationale(reseau, dry === '1');
  }

  /** POST /admin/sync-lmdj — Import des centres LMDJ scrapés (scripts/lmdj-centres.json). */
  @Post('sync-lmdj')
  syncLmdj(@Body() body: any[]) {
    return this.adminService.syncLmdj(body);
  }

  @Patch('centres/:id/reseau')
  updateCentreReseau(@Param('id') id: string, @Body('reseau') reseau: string | null) {
    return this.adminService.updateCentreReseau(id, reseau);
  }

  @Get('claims')
  getClaimsEnAttente() {
    return this.claimService.getClaimsEnAttente();
  }

  /** GET /admin/centres/pending — Centres PENDING d'hébergeurs déjà validés (à activer). */
  @Get('centres/pending')
  getCentresPending() {
    return this.adminService.getCentresPending();
  }

  /** PATCH /admin/centres/:id/activer — Activer un centre PENDING (+ email hébergeur). */
  @Patch('centres/:id/activer')
  activerCentre(@Param('id') id: string) {
    return this.adminService.activerCentre(id);
  }

  /** PATCH /admin/centres/:id/refuser — Refuser un centre PENDING (+ email motivé). */
  @Patch('centres/:id/refuser')
  refuserCentre(@Param('id') id: string, @Body('motif') motif?: string) {
    return this.adminService.refuserCentre(id, motif);
  }

  @Patch('claims/:id/valider')
  validerClaim(
    @Param('id') membershipId: string,
    @Request() req: any,
  ) {
    return this.claimService.validerClaim(membershipId, req.user.id);
  }

  @Patch('claims/:id/refuser')
  refuserClaim(
    @Param('id') membershipId: string,
    @Body('motif') motif: string,
  ) {
    return this.claimService.refuserClaim(membershipId, motif);
  }

  @Get('invitations')
  getInvitations() {
    return this.invitationService.getInvitations();
  }

  @Post('invitations')
  creerInvitation(@Body() dto: CreateInvitationDto) {
    return this.invitationService.create(dto);
  }

  @Post('invitations/:id/renvoyer')
  renvoyerInvitation(@Param('id') id: string) {
    return this.invitationService.renvoyer(id);
  }
}

@Controller('reseau')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.RESEAU, Role.ADMIN)
export class ReseauController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getMyReseauStats(@Request() req: any, @Query('periode') periode?: string) {
    const reseau = req.user.reseauNom;
    if (!reseau) throw new Error('Compte réseau non configuré');
    return this.adminService.getReseauStats(reseau, periode, req.user.reseauNomComplet);
  }

  @Get('demandes')
  getMyReseauDemandes(@Request() req: any, @Query('periode') periode?: string) {
    const reseau = req.user.reseauNom;
    if (!reseau) throw new Error('Compte réseau non configuré');
    return this.adminService.getReseauDemandes(reseau, periode);
  }

  @Get('centres/:id')
  getCentreDetail(@Request() req: any, @Param('id') id: string) {
    const reseau = req.user.reseauNom;
    if (!reseau) throw new Error('Compte réseau non configuré');
    return this.adminService.getReseauCentreDetail(id, reseau);
  }

  @Post('inviter')
  inviterCentre(@Request() req: any, @Body() body: { email: string; nomCentre: string }) {
    const reseau = req.user.reseauNom;
    if (!reseau) throw new Error('Compte réseau non configuré');
    return this.adminService.inviterCentreReseau(reseau, body.email, body.nomCentre);
  }
}
