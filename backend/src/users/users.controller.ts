import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { UpdateEtablissementDto } from './dto/update-etablissement.dto.js';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /** GET /users/me — Profil complet de l'utilisateur connecté */
  @Get('me')
  @Roles(Role.ORGANISATEUR, Role.SIGNATAIRE, Role.AUTORITE, Role.PARENT, Role.HEBERGEUR)
  getMe(@CurrentUser() user: JwtUser) {
    return this.usersService.getProfile(user.id);
  }

  /** PATCH /users/mon-etablissement — Sauvegarder l'établissement */
  @Patch('mon-etablissement')
  @Roles(Role.ORGANISATEUR)
  updateEtablissement(
    @Body() dto: UpdateEtablissementDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.updateEtablissement(user.id, dto);
  }

  /** PATCH /users/mon-profil — Mettre à jour le profil (SIGNATAIRE) */
  @Patch('mon-profil')
  @Roles(Role.SIGNATAIRE)
  updateProfil(
    @Body() dto: { emailRectorat?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.updateProfil(user.id, dto);
  }
}
