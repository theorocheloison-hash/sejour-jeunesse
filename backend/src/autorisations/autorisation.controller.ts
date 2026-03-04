import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
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
  ) {
    return this.autorisationService.signer(token, dto);
  }
}
