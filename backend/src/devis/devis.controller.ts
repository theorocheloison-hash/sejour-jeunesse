import { Body, Controller, Get, Param, Patch, Post, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { DevisService } from './devis.service.js';
import { CreateDevisDto } from './dto/create-devis.dto.js';
import { UpdateStatutDevisDto } from './dto/update-statut-devis.dto.js';

@Controller('devis')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DevisController {
  constructor(private readonly devisService: DevisService) {}

  @Post()
  @Roles(Role.VENUE)
  @UseInterceptors(FileInterceptor('file'))
  create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDevisDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.devisService.create(dto, user.id, file);
  }

  @Get('mes-devis')
  @Roles(Role.VENUE)
  getMesDevis(@CurrentUser() user: JwtUser) {
    return this.devisService.getMesDevis(user.id);
  }

  @Get('next-numero')
  @Roles(Role.VENUE)
  getNextNumeroDevis(@CurrentUser() user: JwtUser) {
    return this.devisService.getNextNumeroDevis(user.id);
  }

  @Get('a-valider')
  @Roles(Role.DIRECTOR)
  getDevisAValider() {
    return this.devisService.getDevisAValider();
  }

  @Get('factures-acompte')
  @Roles(Role.DIRECTOR)
  getFacturesAcompte() {
    return this.devisService.getFacturesAcompte();
  }

  @Get('demande/:demandeId')
  @Roles(Role.TEACHER, Role.DIRECTOR)
  getDevisForDemande(@CurrentUser() user: JwtUser, @Param('demandeId') demandeId: string) {
    return this.devisService.getDevisForDemande(demandeId, user);
  }

  @Get('demande-info/:demandeId')
  @Roles(Role.VENUE)
  getDemandeInfo(@CurrentUser() user: JwtUser, @Param('demandeId') demandeId: string) {
    return this.devisService.getDemandeInfo(demandeId, user.id);
  }

  @Patch(':id/statut')
  @Roles(Role.TEACHER, Role.DIRECTOR)
  updateStatut(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatutDevisDto,
  ) {
    return this.devisService.updateStatut(id, dto.statut, user.id, user.role);
  }

  @Patch(':id/facturer-acompte')
  @Roles(Role.VENUE)
  facturerAcompte(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ) {
    return this.devisService.facturerAcompte(id, user.id);
  }

  @Patch(':id/valider-acompte')
  @Roles(Role.DIRECTOR)
  validerAcompte(@Param('id') id: string) {
    return this.devisService.validerAcompte(id);
  }

  @Get(':id/chorus-xml')
  @Roles(Role.DIRECTOR)
  getChorusXml(@Param('id') id: string) {
    return this.devisService.getChorusXml(id);
  }
}
