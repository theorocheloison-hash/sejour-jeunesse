import {
  Body, Controller, Delete, Get, Param, Patch, Post,
  Req, UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { DevisLibresService } from './devis-libres.service.js';
import {
  CreateDevisLibreDto, UpdateDevisLibreDto,
  AjouterVersementDto, SignerDevisDto,
} from './dto/create-devis-libre.dto.js';
import { CentreId } from '../centres/centre-id.decorator.js';

@Controller('devis-libres')
export class DevisLibresController {
  constructor(private readonly service: DevisLibresService) {}

  // ── Routes publiques SANS guard (déclarées EN PREMIER) ──────────────────

  @Get('signer/:token')
  getForSignature(@Param('token') token: string) {
    return this.service.getForSignature(token);
  }

  @Post('signer/:token')
  signer(
    @Param('token') token: string,
    @Body() dto: SignerDevisDto,
    @Req() req: Request,
  ) {
    return this.service.signer(token, dto, req);
  }

  // ── Routes protégées HEBERGEUR ──────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getMesDevisLibres(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.service.getMesDevisLibres(user.id, centreId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateDevisLibreDto, @CentreId() centreId: string | null) {
    return this.service.create(dto, user.id, centreId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getOne(@CurrentUser() user: JwtUser, @Param('id') id: string, @CentreId() centreId: string | null) {
    return this.service.getOne(id, user.id, centreId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateDevisLibreDto,
    @CentreId() centreId: string | null,
  ) {
    return this.service.update(id, dto, user.id, centreId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string, @CentreId() centreId: string | null) {
    return this.service.remove(id, user.id, centreId);
  }

  @Post(':id/envoyer')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  envoyer(@CurrentUser() user: JwtUser, @Param('id') id: string, @CentreId() centreId: string | null) {
    return this.service.envoyer(id, user.id, centreId);
  }

  @Post(':id/versements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  ajouterVersement(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: AjouterVersementDto,
    @CentreId() centreId: string | null,
  ) {
    return this.service.ajouterVersement(id, dto, user.id, centreId);
  }
}
