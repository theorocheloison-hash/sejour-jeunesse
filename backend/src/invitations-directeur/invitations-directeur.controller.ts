import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { Role } from '@prisma/client';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { InvitationsDirecteurService } from './invitations-directeur.service.js';

class CreerInvitationDto {
  @IsString() sejourId!: string;
  @IsString() devisId!: string;
  @IsEmail() emailDirecteur!: string;
  @IsString() enseignantPrenom!: string;
  @IsString() sejourTitre!: string;
  @IsOptional() @IsString() etablissementUai?: string;
  @IsOptional() @IsString() etablissementNom?: string;
  @IsOptional() @IsString() organisationId?: string;
  @IsOptional() @IsString() typeContexte?: string;
}

class SignerSansCompteDto {
  @IsString() nomSignataire!: string;
  @IsOptional() @IsString() fonctionSignataire?: string;
}

@Controller('invitations-directeur')
export class InvitationsDirecteurController {
  constructor(private readonly service: InvitationsDirecteurService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ORGANISATEUR)
  creer(
    @Body() dto: CreerInvitationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.creer(dto, user.id);
  }

  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.service.findByToken(token);
  }

  @Post(':token/utiliser')
  marquerUtilisee(@Param('token') token: string) {
    return this.service.marquerUtilisee(token);
  }

  @Post(':token/signer-sans-compte')
  signerSansCompte(
    @Param('token') token: string,
    @Body() dto: SignerSansCompteDto,
    @Req() req: Request,
  ) {
    return this.service.signerSansCompte(token, {
      nomSignataire: dto.nomSignataire,
      fonctionSignataire: dto.fonctionSignataire ?? '',
      ipAddress: req.ip,
    });
  }
}
