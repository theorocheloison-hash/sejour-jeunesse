import { Controller, Get, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { StorageService } from './storage.service.js';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private readonly storage: StorageService) {}

  /** GET /storage/signed-url?url=... — retourne une URL signée (15 min) pour un fichier S3. */
  @Get('signed-url')
  async getSignedUrl(@Query('url') url: string) {
    if (!url) throw new BadRequestException('Paramètre url requis');
    const signedUrl = await this.storage.generateSignedUrl(url);
    return { signedUrl };
  }
}
