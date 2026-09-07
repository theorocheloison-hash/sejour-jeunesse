import { BadRequestException, Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';

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

  /** PATCH /users/mon-profil — Mettre à jour le profil (SIGNATAIRE) */
  @Patch('mon-profil')
  @Roles(Role.SIGNATAIRE)
  updateProfil(
    @Body() dto: { emailRectorat?: string },
    @CurrentUser() user: JwtUser,
  ) {
    return this.usersService.updateProfil(user.id, dto);
  }

  /** PATCH /users/me/onboarding-tour — Progression du tour organisateur (Lot 2) */
  @Patch('me/onboarding-tour')
  @Roles(Role.ORGANISATEUR)
  setOnboardingTour(
    @Body() dto: { etape: number },
    @CurrentUser() user: JwtUser,
  ) {
    if (!Number.isInteger(dto?.etape) || dto.etape < 0) {
      throw new BadRequestException('etape doit être un entier positif ou nul');
    }
    return this.usersService.setOnboardingTourEtape(user.id, dto.etape);
  }
}
