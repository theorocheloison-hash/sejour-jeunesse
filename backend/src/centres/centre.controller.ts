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

  @Get('mon-profil')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  getMonProfil(@CurrentUser() user: JwtUser) {
    return this.centreService.getMonProfil(user.id);
  }

  @Patch('mon-profil')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  updateMonProfil(@CurrentUser() user: JwtUser, @Body() dto: UpdateCentreDto) {
    return this.centreService.updateMonProfil(user.id, dto);
  }

  @Post('image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @CurrentUser() user: JwtUser,
    @UploadedFile() file: Express.Multer.File,
  ) {
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    return this.centreService.uploadImage(user.id, file);
  }

  @Post('documents-upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
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
  @Roles(Role.VENUE)
  accepterMandatFacturation(@CurrentUser() user: JwtUser, @Req() req: any) {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? null;
    const ua = (req.headers['user-agent'] as string) ?? null;
    return this.centreService.accepterMandatFacturation(user.id, ip, ua);
  }

  @Get('disponibilites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  getDisponibilites(@CurrentUser() user: JwtUser) {
    return this.centreService.getDisponibilites(user.id);
  }

  @Post('disponibilites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  createDisponibilite(@CurrentUser() user: JwtUser, @Body() dto: CreateDisponibiliteDto) {
    return this.centreService.createDisponibilite(user.id, dto);
  }

  @Delete('disponibilites/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  deleteDisponibilite(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.centreService.deleteDisponibilite(user.id, id);
  }

  @Get('documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  getDocuments(@CurrentUser() user: JwtUser) {
    return this.centreService.getDocuments(user.id);
  }

  @Post('documents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  createDocument(@CurrentUser() user: JwtUser, @Body() dto: CreateDocumentDto) {
    return this.centreService.createDocument(user.id, dto);
  }

  @Get('catalogue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  getCatalogue(@CurrentUser() user: JwtUser) {
    return this.centreService.getProduitsCatalogue(user.id);
  }

  @Post('catalogue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  createProduit(
    @CurrentUser() user: JwtUser,
    @Body() dto: { nom: string; description?: string; type: string; prixUnitaireHT: number; prixUnitaireTTC?: number; tva: number; unite: string },
  ) {
    return this.centreService.createProduit(user.id, dto);
  }

  @Post('catalogue/import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  importProduits(
    @CurrentUser() user: JwtUser,
    @Body() body: { produits: { nom: string; description?: string; type: string; prixUnitaireHT: number; prixUnitaireTTC?: number; tva: number; unite: string }[] },
  ) {
    return this.centreService.importProduits(user.id, body.produits);
  }

  @Patch('catalogue/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  updateProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { nom?: string; description?: string; type?: string; prixUnitaireHT?: number; prixUnitaireTTC?: number; tva?: number; unite?: string },
  ) {
    return this.centreService.updateProduit(user.id, id, dto);
  }

  @Delete('catalogue/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  archiveProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.centreService.archiveProduit(user.id, id);
  }

  @Patch('catalogue/:id/capacites')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  updateCapacitesProduit(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: { capaciteParGroupe?: number; encadrementParGroupe?: number; simultaneitePossible?: boolean; dureeMinutes?: number },
  ) {
    return this.centreService.updateCapacitesProduit(user.id, id, dto);
  }

  @Get('contraintes-centre')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  getContraintesCentre(@CurrentUser() user: JwtUser) {
    return this.centreService.getContraintesCentre(user.id);
  }

  @Post('contraintes-centre')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  createContrainteCentre(
    @CurrentUser() user: JwtUser,
    @Body() dto: { libelle: string; type: string; jourSemaine?: number; heureDebut?: string; heureFin?: string },
  ) {
    return this.centreService.createContrainteCentre(user.id, dto);
  }

  @Delete('contraintes-centre/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VENUE)
  deleteContrainteCentre(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.centreService.deleteContrainteCentre(user.id, id);
  }
}
