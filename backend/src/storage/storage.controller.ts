import { Controller, Get, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { StorageService } from './storage.service.js';
import { CurrentUser, type JwtUser } from '../auth/decorators/current-user.decorator.js';
import { SecuriteService } from '../securite/securite.service.js';

@Controller('storage')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(
    private readonly storage: StorageService,
    private readonly securite: SecuriteService,
  ) {}

  /** GET /storage/signed-url?url=...&filename=... — retourne une URL signée (15 min) pour un fichier S3.
   *  `filename` (optionnel) force le nom au téléchargement (Content-Disposition). */
  @Get('signed-url')
  async getSignedUrl(
    @CurrentUser() user: JwtUser,
    @Query('url') url: string,
    @Query('filename') filename?: string,
  ) {
    if (!url) throw new BadRequestException('Paramètre url requis');
    // Nettoyage anti-injection d'en-tête : caractères sûrs uniquement, longueur bornée
    const safeFilename = filename
      ? filename.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120)
      : undefined;
    const signedUrl = await this.storage.generateSignedUrl(url, undefined, safeFilename);
    // Alertes maison : ouvertures de documents médicaux comptées par compte.
    this.securite.lienDocumentGenere(user.id, url);
    return { signedUrl };
  }
}
