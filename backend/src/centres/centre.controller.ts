import {
  Body,
  Controller,
  Delete,
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
import { CentreService } from './centre.service.js';
import { RegisterCentreDto } from './dto/register-centre.dto.js';
import { UpdateCentreDto } from './dto/update-centre.dto.js';
import { CreateDisponibiliteDto } from './dto/create-disponibilite.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';

@Controller('centres')
export class CentreController {
  constructor(private readonly centreService: CentreService) {}

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
}
