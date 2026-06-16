import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { FactureService } from './facture.service.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';

@Controller('factures')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard)
export class FactureController {
  constructor(private readonly factureService: FactureService) {}

  /** POST /factures/acompte — émet la facture d'acompte d'un devis */
  @Post('acompte')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('facturation')
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
  @RequirePermission('facturation')
  emettreSolde(
    @CurrentUser() user: JwtUser,
    @Body() body: { devisId: string },
    @CentreId() centreId: string | null,
  ) {
    return this.factureService.emettreFactureSolde(body.devisId, user.id, centreId);
  }

  /** POST /factures/total — émet une facture de solde couvrant 100% (sans acompte préalable) */
  @Post('total')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('facturation')
  emettreTotal(
    @CurrentUser() user: JwtUser,
    @Body() body: { devisId: string },
    @CentreId() centreId: string | null,
  ) {
    return this.factureService.emettreFactureTotal(body.devisId, user.id, centreId);
  }

  /** POST /factures/avoir — émet un avoir sur une facture existante (ACOMPTE ou SOLDE) */
  @Post('avoir')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('facturation')
  emettreAvoir(
    @CurrentUser() user: JwtUser,
    @Body() body: {
      factureAnnuleeId: string;
      montant: number;
      motif: string;
      lignes: Array<{
        description: string;
        quantite: number;
        prixUnitaire: number;
        tva: number;
        totalHT: number;
        totalTTC: number;
      }>;
    },
    @CentreId() centreId: string | null,
  ) {
    return this.factureService.emettreAvoir(
      body.factureAnnuleeId,
      { montant: body.montant, motif: body.motif, lignes: body.lignes },
      user.id,
      centreId,
    );
  }

  /** POST /factures/versements — enregistre un versement avec routage auto vers la bonne facture */
  @Post('versements')
  @Roles(Role.SIGNATAIRE, Role.HEBERGEUR)
  ajouterVersement(
    @CurrentUser() user: JwtUser,
    @Body() body: { devisId: string; montant: number; datePaiement: string; reference?: string; modePaiement?: string },
    @CentreId() centreId: string | null,
  ) {
    return this.factureService.ajouterVersement(body.devisId, body, user.id, centreId);
  }

  /** POST /factures/:id/envoyer — envoie la facture par email avec PDF joint */
  @Post(':id/envoyer')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('facturation')
  envoyerParEmail(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { email: string; message: string },
    @CentreId() centreId: string | null,
  ) {
    return this.factureService.envoyerFactureParEmail(id, body, user.id, centreId);
  }

  /** GET /factures/devis/:devisId — factures liées à un devis */
  @Get('devis/:devisId')
  @Roles(Role.HEBERGEUR, Role.SIGNATAIRE)
  getFacturesForDevis(@Param('devisId') devisId: string) {
    return this.factureService.getFacturesForDevis(devisId);
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
  @RequirePermission('facturation')
  regenererPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
  ) {
    return this.factureService.regenererPdf(id, user.id, centreId);
  }
}
