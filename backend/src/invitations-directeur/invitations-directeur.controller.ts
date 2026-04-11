import { Controller, Get, Param, Post } from '@nestjs/common';
import { InvitationsDirecteurService } from './invitations-directeur.service.js';

@Controller('invitations-directeur')
export class InvitationsDirecteurController {
  constructor(private readonly service: InvitationsDirecteurService) {}

  @Get(':token')
  findByToken(@Param('token') token: string) {
    return this.service.findByToken(token);
  }

  @Post(':token/utiliser')
  marquerUtilisee(@Param('token') token: string) {
    return this.service.marquerUtilisee(token);
  }
}
