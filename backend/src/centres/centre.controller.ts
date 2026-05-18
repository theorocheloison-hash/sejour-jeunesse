import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { CentreService } from './centre.service.js';
import { RegisterCentreDto } from './dto/register-centre.dto.js';
import { UpdateCentreDto } from './dto/update-centre.dto.js';
import { CreateDisponibiliteDto } from './dto/create-disponibilite.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';

@Controller('centres')
export class CentreController {
  constructor(private readonly centreService: CentreService) {}

  /** GET /centres/search-public?search=xxx — Recherche publique (pas d'auth) */
  @Get('search-public')
  searchPublic(@Query('search') search?: string) {
    return this.centreService.searchPublic(search ?? '');
  }

  @Get('check-invitation/:token')
  async checkInvitation(@Param('token') token: string) {
    return this.centreService.checkInvitation(token);
  }

  @Post('register')
  register(@Body() dto: RegisterCentreDto) {
    return this.centreService.register(dto);
  }

  @Post('materialiser-en')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  materialiserCentreEN(@Body() body: {
    identifiantEN: string;
    nom: string;
    ville: string;
    codePostal: string;
    capacite: number;
    departement: string | null;
  }) {
    return this.centreService.materialiserCentreEN(body);
  }

  @Get('mon-profil')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getMonProfil(@CurrentUser() user: JwtUser) {
    return this.centreService.getMonProfil(user.id);
  }

  @Patch('mon-profil')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  updateMonProfil(@CurrentUser() user: JwtUser, @Body() dto: UpdateCentreDto) {
    return this.centreService.updateMonProfil(user.id, dto);
  }

  @Post('image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.centreService.uploadImage(user.id, file);
  }

  @Post('brochure-upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('file'))
  uploadBrochure(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.centreService.uploadBrochure(user.id, file);
  }

  @Post('documents-upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateDocumentDto,
  ) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.centreService.uploadDocument(user.id, file, dto);
  }

  @Patch('mandat-facturation')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  accepterMandatFacturation(@CurrentUser() user: JwtUser, @Req() req: any) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;
    const ua = (req.headers['user-agent'] as string) ?? null;
    return this.centreService.accepterMandatFacturation(user.id, ip, ua);
  }

  @Get('disponibilites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getDisponibilites(@CurrentUser() user: JwtUser) {
    return this.centreService.getDisponibilites(user.id);
  }

  @Post('disponibilites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  createDisponibilite(@CurrentUser() user: JwtUser, @Body() dto: CreateDisponibiliteDto) {
    return this.centreService.createDisponibilite(user.id, dto);
  }

  @Delete('disponibilites/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  deleteDisponibilite(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.centreService.deleteDisponibilite(user.id, id);
  }

  @Get('documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getDocuments(@CurrentUser() user: JwtUser) {
    return this.centreService.getDocuments(user.id);
  }

  @Post('documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  createDocument(@CurrentUser() user: JwtUser, @Body() dto: CreateDocumentDto) {
    return this.centreService.createDocument(user.id, dto);
  }

  @Get('catalogue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getCatalogue(@CurrentUser() user: JwtUser) {
    return this.centreService.getProduitsCatalogue(user.id);
  }

  @Post('catalogue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  createProduit(
    @CurrentUser() user: JwtUser,
    @Body() dto: { nom: string; description?: string; type: string; prixUnitaireHT: number; prixUnitaireTTC?: number; tva: number; unite: string },
  ) {
    return this.centreService.createProduit(user.id, dto);
  }

  @Post('catalogue/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  importProduits(
    @CurrentUser() user: JwtUser,
    @Body() body: { produits: { nom: string; description?: string; type: string; prixUnitaireHT: number; prixUnitaireTTC?: number; tva: number; unite: string }[] },
  ) {
    return this.centreService.importProduits(user.id, body.produits);
  }

  @Patch('catalogue/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  updateProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { nom?: string; description?: string; type?: string; prixUnitaireHT?: number; prixUnitaireTTC?: number; tva?: number; unite?: string },
  ) {
    return this.centreService.updateProduit(user.id, id, dto);
  }

  @Delete('catalogue/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  archiveProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.centreService.archiveProduit(user.id, id);
  }

  @Patch('catalogue/:id/capacites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  updateCapacitesProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { capaciteParGroupe?: number; encadrementParGroupe?: number; simultaneitePossible?: boolean; dureeMinutes?: number },
  ) {
    return this.centreService.updateCapacitesProduit(user.id, id, dto);
  }

}
