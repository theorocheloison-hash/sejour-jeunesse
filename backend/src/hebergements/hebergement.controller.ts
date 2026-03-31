import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { HebergementService } from './hebergement.service.js';
import { SearchHebergementDto } from './dto/search-hebergement.dto.js';

@Controller('hebergements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEACHER)
export class HebergementController {
  constructor(private readonly hebergementService: HebergementService) {}

  @Get()
  search(@Query() dto: SearchHebergementDto) {
    return this.hebergementService.search(dto);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.hebergementService.findById(id);
  }

  @Post(':id/interet')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.TEACHER)
  async manifesterInteret(
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
    @Body() body: { message?: string },
  ) {
    return this.hebergementService.manifesterInteret(id, user.id, body.message);
  }
}
