import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { CentreId } from '../centres/centre-id.decorator.js';
import { CollaborateurService } from './collaborateur.service.js';
import { InviteCollaborateurDto } from './dto/invite-collaborateur.dto.js';

@Controller('collaborateurs')
export class CollaborateurController {
  constructor(private readonly collaborateurService: CollaborateurService) {}

  /** POST /collaborateurs/inviter — Inviter un collaborateur (propriétaire uniquement). */
  @Post('inviter')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  inviter(@CurrentUser() user: JwtUser, @Body() dto: InviteCollaborateurDto) {
    return this.collaborateurService.inviter(user.id, dto);
  }

  /** GET /collaborateurs — Collaborateurs des centres dont l'user est propriétaire. */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  getAll(@CurrentUser() user: JwtUser) {
    return this.collaborateurService.getAll(user.id);
  }

  /** GET /collaborateurs/mes-permissions — Permissions de l'user sur le centre actif. */
  @Get('mes-permissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  mesPermissions(@CurrentUser() user: JwtUser, @CentreId() centreId: string | null) {
    return this.collaborateurService.mesPermissions(user.id, centreId);
  }

  /** POST /collaborateurs/accepter — Accepter une invitation (user connecté). */
  @Post('accepter')
  @UseGuards(JwtAuthGuard)
  accepter(@CurrentUser() user: JwtUser, @Body() body: { token: string }) {
    return this.collaborateurService.accepter(user.id, user.email, body.token);
  }

  /** PATCH /collaborateurs/:id — Modifier les permissions (propriétaire uniquement). */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  updatePermissions(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { permissions: InviteCollaborateurDto['permissions'] },
  ) {
    return this.collaborateurService.updatePermissions(user.id, id, body.permissions);
  }

  /** DELETE /collaborateurs/:id — Supprimer un collaborateur (propriétaire uniquement). */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.HEBERGEUR)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.collaborateurService.remove(user.id, id);
  }
}
