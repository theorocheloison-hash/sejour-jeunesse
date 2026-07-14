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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { RentabiliteService } from './rentabilite.service.js';
import { CreateFacturePrestatireDto } from './dto/create-facture-prestataire.dto.js';
import { PermissionGuard } from '../auth/guards/permission.guard.js';
import { RequirePermission } from '../auth/decorators/permission.decorator.js';
import { PlanGuard } from '../auth/guards/plan.guard.js';
import { RequirePlan } from '../auth/decorators/plan.decorator.js';

@Controller('rentabilite')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionGuard, PlanGuard)
@RequirePlan('PILOTAGE')
export class RentabiliteController {
  constructor(private readonly rentabiliteService: RentabiliteService) {}

  /** POST /rentabilite/factures — crée une facture prestataire + ventilations */
  @Post('factures')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('facturation')
  createFacture(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateFacturePrestatireDto,
    @CentreId() centreId: string | null,
  ) {
    return this.rentabiliteService.createFacture(dto, user.id, centreId);
  }

  /** GET /rentabilite/factures — liste les factures du centre */
  @Get('factures')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('facturation')
  getMesFactures(
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
    @Query('sejourId') sejourId?: string,
  ) {
    return this.rentabiliteService.getMesFactures(user.id, centreId, sejourId);
  }

  /** PATCH /rentabilite/factures/:id — met à jour une facture (replace ventilations) */
  @Patch('factures/:id')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('facturation')
  updateFacture(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: CreateFacturePrestatireDto,
    @CentreId() centreId: string | null,
  ) {
    return this.rentabiliteService.updateFacture(id, dto, user.id, centreId);
  }

  /** DELETE /rentabilite/factures/:id — supprime une facture */
  @Delete('factures/:id')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('facturation')
  deleteFacture(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
  ) {
    return this.rentabiliteService.deleteFacture(id, user.id, centreId);
  }

  /** POST /rentabilite/factures/:id/upload — attache un justificatif (champ `document`) */
  @Post('factures/:id/upload')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('facturation')
  @UseInterceptors(FileInterceptor('document'))
  uploadFichier(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @CentreId() centreId: string | null,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (file) {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    }
    return this.rentabiliteService.uploadFichier(id, user.id, file!, centreId);
  }

  /** GET /rentabilite/tableau — tableau P&L par séjour (CA − charges) */
  @Get('tableau')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('facturation')
  getTableau(
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
    @Query('mois') mois?: string,
    @Query('annee') annee?: string,
    @Query('sejourId') sejourId?: string,
  ) {
    return this.rentabiliteService.getTableau(
      user.id,
      centreId,
      mois,
      annee,
      sejourId,
    );
  }

  /** GET /rentabilite/tva-marge — TVA sur marge (art. 266-1-e CGI), tableau annuel pour l'EC */
  @Get('tva-marge')
  @Roles(Role.HEBERGEUR)
  @RequirePermission('facturation')
  getTvaSurMarge(
    @CurrentUser() user: JwtUser,
    @CentreId() centreId: string | null,
    @Query('annee') annee?: string,
  ) {
    const anneeNum = Number(annee);
    if (!annee || !Number.isInteger(anneeNum) || anneeNum < 2000 || anneeNum > 2100) {
      throw new BadRequestException(
        'Paramètre annee invalide (entier attendu entre 2000 et 2100)',
      );
    }
    return this.rentabiliteService.getTvaSurMarge(user.id, centreId, anneeNum);
  }
}
