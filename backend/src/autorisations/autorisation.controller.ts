import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { AutorisationService } from './autorisation.service.js';
import { CreateAutorisationDto } from './dto/create-autorisation.dto.js';
import { SignerAutorisationDto } from './dto/signer-autorisation.dto.js';

@Controller('autorisations')
export class AutorisationController {
  constructor(private readonly autorisationService: AutorisationService) {}

  /** POST /autorisations — Créer une autorisation (TEACHER) */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  create(
    @Body() dto: CreateAutorisationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.create(dto, user.id);
  }

  /** PATCH /autorisations/:id/valider-paiement — Valider le paiement (TEACHER/DIRECTOR) */
  @Patch(':id/valider-paiement')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DIRECTOR, Role.TEACHER)
  validerPaiement(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.validerPaiement(id, user.id);
  }

  /** PATCH /autorisations/:id/valider-paiement-partiel — Enregistrer un versement partiel */
  @Patch(':id/valider-paiement-partiel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.DIRECTOR, Role.TEACHER)
  validerPaiementPartiel(
    @Param('id') id: string,
    @Body() body: { montant: number },
  ) {
    return this.autorisationService.validerPaiementPartiel(id, body.montant);
  }

  /** GET /autorisations/sejour/:sejourId — Liste des autorisations d'un séjour (TEACHER) */
  @Get('sejour/:sejourId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  getBySejour(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.autorisationService.getBySejour(sejourId, user.id);
  }

  /** GET /autorisations/signer/:token — Infos publiques (PAS de guard) */
  @Get('signer/:token')
  getByToken(@Param('token') token: string) {
    return this.autorisationService.getByToken(token);
  }

  /** PATCH /autorisations/signer/:token — Signer (PAS de guard) */
  @Patch('signer/:token')
  signer(
    @Param('token') token: string,
    @Body() dto: SignerAutorisationDto,
    @Req() req: Request,
  ) {
    return this.autorisationService.signer(token, dto, req.ip);
  }

  /** POST /autorisations/:token/document — Upload document médical (PAS de guard) */
  @Post(':token/document')
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('type') type?: string,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier fourni');
    return this.autorisationService.uploadDocumentMedical(token, file, type);
  }
}
