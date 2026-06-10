import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { DevisService } from './devis.service.js';

@Controller('devis/public')
export class DevisPublicController {
  constructor(private readonly devisService: DevisService) {}

  /** GET /devis/public/:token — Données publiques du devis pour la page de signature */
  @Get(':token')
  getDevisPublic(@Param('token') token: string) {
    return this.devisService.getDevisPublicByToken(token);
  }

  /** POST /devis/public/:token/signer — Signature directe par le client */
  @Post(':token/signer')
  signerDirect(
    @Param('token') token: string,
    @Body() body: { nomSignataire: string; fonctionSignataire?: string; confirmation: boolean },
    @Req() req: Request,
  ) {
    return this.devisService.signerDevisDirect(token, body, req);
  }

  /** POST /devis/public/:token/envoyer-direction — Déléguer la signature à la direction */
  @Post(':token/envoyer-direction')
  envoyerDirection(
    @Param('token') token: string,
    @Body() body: { emailDirecteur: string; nomDirecteur?: string },
  ) {
    return this.devisService.envoyerADirection(token, body);
  }

  /** POST /devis/public/:token/upload-signature — Upload scan signé */
  @Post(':token/upload-signature')
  @UseInterceptors(FileInterceptor('file'))
  uploadSignaturePublic(
    @Param('token') token: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { nomSignataire?: string },
    @Req() req: Request,
  ) {
    return this.devisService.uploadSignaturePublic(token, file, req, body?.nomSignataire);
  }
}
