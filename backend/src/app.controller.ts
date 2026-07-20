import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // Diagnostic TEMPORAIRE trust proxy (à retirer après vérif) — public volontairement.
  // Route hors /health : le middleware app.use('/health') de main.ts intercepte
  // tous les sous-chemins /health/* avant le routeur Nest.
  @Get('debug-ip')
  getDebugIp(@Req() req: Request) {
    return {
      ip: req.ip,
      xForwardedFor: req.headers['x-forwarded-for'] ?? null,
    };
  }
}
