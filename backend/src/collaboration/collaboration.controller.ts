import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtUser } from '../auth/decorators/current-user.decorator.js';
import { CollaborationService } from './collaboration.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { CreatePlanningDto } from './dto/create-planning.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';

@Controller('collaboration')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER, Role.VENUE)
export class CollaborationController {
  constructor(private readonly service: CollaborationService) {}

  // ── Route statique AVANT :sejourId ────────────────────────────

  @Get('mes-sejours')
  getMesSejoursConvention(@CurrentUser() user: JwtUser) {
    return this.service.getMesSejoursConvention(user.id);
  }

  // ── Infos séjour ──────────────────────────────────────────────

  @Get(':sejourId')
  getSejourInfo(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getSejourInfo(sejourId, user.id);
  }

  // ── Participants ─────────────────────────────────────────────

  @Get(':sejourId/participants')
  getParticipants(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getParticipants(sejourId, user.id);
  }

  // ── Messages ──────────────────────────────────────────────────

  @Get(':sejourId/messages')
  getMessages(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getMessages(sejourId, user.id);
  }

  @Post(':sejourId/messages')
  createMessage(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateMessageDto,
  ) {
    return this.service.createMessage(sejourId, user.id, dto);
  }

  // ── Planning ──────────────────────────────────────────────────

  @Get(':sejourId/planning')
  getPlanning(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getPlanning(sejourId, user.id);
  }

  @Post(':sejourId/planning')
  createPlanning(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreatePlanningDto,
  ) {
    return this.service.createPlanning(sejourId, user.id, dto);
  }

  @Delete(':sejourId/planning/:planningId')
  deletePlanning(
    @Param('sejourId') sejourId: string,
    @Param('planningId') planningId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.deletePlanning(sejourId, user.id, planningId);
  }

  // ── Documents ─────────────────────────────────────────────────

  @Get(':sejourId/documents')
  getDocuments(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.getDocuments(sejourId, user.id);
  }

  @Post(':sejourId/documents')
  createDocument(
    @Param('sejourId') sejourId: string,
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.service.createDocument(sejourId, user.id, dto);
  }
}
