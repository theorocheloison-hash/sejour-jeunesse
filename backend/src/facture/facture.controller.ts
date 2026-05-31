import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { FactureService } from './facture.service.js';

@Controller('factures')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FactureController {
  constructor(private readonly factureService: FactureService) {}

  /** POST /factures/acompte — émet la facture d'acompte d'un devis */
  @Post('acompte')
  @Roles(Role.HEBERGEUR)
  emettreAcompte(
    @CurrentUser() user: JwtUser,
    @Body() body: { devisId: string },
    @CentreId() centreId: string | null,
  ) {
    return this.factureService.emettreAcompte(body.devisId, user.id, centreId);
  }

  /** POST /factures/solde — émet la facture de solde (total révisé − acompte) */
  @Post('solde')
  @Roles(Role.HEBERGEUR)
  emettreSolde(
    @CurrentUser() user: JwtUser,
    @Body() body: { devisId: string },
    @CentreId() centreId: string | null,
  ) {
    return this.factureService.emettreFactureSolde(body.devisId, user.id, centreId);
  }

  /** GET /factures/devis/:devisId — factures liées à un devis */
  @Get('devis/:devisId')
  @Roles(Role.HEBERGEUR, Role.SIGNATAIRE)
  getFacturesForDevis(@Param('devisId') devisId: string) {
    return this.factureService.getFacturesForDevis(devisId);
  }

  /** POST /factures/:id/versements — enregistre un versement sur une facture */
  @Post(':id/versements')
  @Roles(Role.SIGNATAIRE, Role.HEBERGEUR)
  ajouterVersement(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { montant: number; datePaiement: string; reference?: string; modePaiement?: string },
    @CentreId() centreId: string | null,
  ) {
    return this.factureService.ajouterVersement(id, body, user.id, centreId);
  }

  /** PATCH /factures/:id/versements/:vid/supprimer */
  @Patch(':id/versements/:vid/supprimer')
  @Roles(Role.SIGNATAIRE, Role.HEBERGEUR)
  supprimerVersement(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Param('vid') vid: string,
    @CentreId() centreId: string | null,
  ) {
    return this.factureService.supprimerVersement(id, vid, user.id, centreId);
  }

  /** PATCH /factures/:id/valider-acompte */
  @Patch(':id/valider-acompte')
  @Roles(Role.SIGNATAIRE, Role.HEBERGEUR)
  validerAcompte(@Param('id') id: string) {
    return this.factureService.validerAcompte(id);
  }

  /** GET /factures/:id/chorus-xml */
  @Get(':id/chorus-xml')
  @Roles(Role.SIGNATAIRE, Role.HEBERGEUR)
  getChorusXml(@Param('id') id: string) {
    return this.factureService.getChorusXml(id);
  }

  /** GET /factures/:id/pdf — redirige (302) vers l'URL OVH du PDF de la facture */
  @Get(':id/pdf')
  @Roles(Role.HEBERGEUR, Role.SIGNATAIRE)
  async downloadPdf(@Param('id') id: string, @Res() res: Response) {
    const facture = await this.factureService.getFactureById(id);
    if (!facture?.pdfUrl) {
      throw new NotFoundException('PDF non disponible pour cette facture');
    }
    res.redirect(302, facture.pdfUrl);
  }

  /** POST /factures/:id/regenerer-pdf — régénère le PDF (si génération initiale échouée) */
  @Post(':id/regenerer-pdf')
  @Roles(Role.HEBERGEUR)
  regenererPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
  ) {
    return this.factureService.regenererPdf(id, user.id, centreId);
  }
}
