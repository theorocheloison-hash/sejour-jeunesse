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
import { AccompagnateurService } from './accompagnateur.service.js';
import { CreateAccompagnateurDto } from './dto/create-accompagnateur.dto.js';
import { SignerAccompagnateurDto } from './dto/signer-accompagnateur.dto.js';

@Controller('accompagnateurs')
export class AccompagnateurController {
  constructor(private readonly service: AccompagnateurService) {}

  /** POST /accompagnateurs — Créer + envoyer ordre de mission (TEACHER) */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  create(
    @Body() dto: CreateAccompagnateurDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(dto, user.id);
  }

  /** GET /accompagnateurs/sejour/:sejourId — Liste (protégé) */
  @Get('sejour/:sejourId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.DIRECTOR, Role.RECTOR, Role.VENUE)
  getBySejour(@Param('sejourId') sejourId: string) {
    return this.service.getBySejour(sejourId);
  }

  /** GET /accompagnateurs/signer/:token — Infos publiques (PAS de guard) */
  @Get('signer/:token')
  getByToken(@Param('token') token: string) {
    return this.service.getByToken(token);
  }

  /** PATCH /accompagnateurs/signer/:token — Signer (PAS de guard) */
  @Patch('signer/:token')
  signer(
    @Param('token') token: string,
    @Body() dto: SignerAccompagnateurDto,
  ) {
    return this.service.signer(token, dto);
  }

  /** GET /accompagnateurs/:id/ordre-mission-pdf — HTML ordre de mission (TEACHER, DIRECTOR) */
  @Get(':id/ordre-mission-pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER, Role.DIRECTOR)
  getOrdreMissionPdf(@Param('id') id: string) {
    return this.service.getOrdreMissionHtml(id);
  }
}
