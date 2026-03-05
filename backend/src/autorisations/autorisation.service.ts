import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { CreateAutorisationDto } from './dto/create-autorisation.dto.js';
import { SignerAutorisationDto } from './dto/signer-autorisation.dto.js';

const FRONTEND_URL = process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';

@Injectable()
export class AutorisationService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  async create(dto: CreateAutorisationDto, createurId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: dto.sejourId },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    const autorisation = await this.prisma.autorisationParentale.create({
      data: {
        sejourId: dto.sejourId,
        eleveNom: dto.eleveNom,
        elevePrenom: dto.elevePrenom,
        parentEmail: dto.parentEmail,
      },
    });

    // Envoyer l'email d'autorisation parentale
    const lien = `${FRONTEND_URL}/autorisation/${autorisation.tokenAcces}`;
    await this.email.sendAutorisationParentale(
      dto.parentEmail,
      `${dto.elevePrenom} ${dto.eleveNom}`,
      sejour.titre,
      lien,
    );

    return autorisation;
  }

  async getByToken(token: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { tokenAcces: token },
      include: {
        sejour: {
          select: {
            titre: true,
            lieu: true,
            dateDebut: true,
            dateFin: true,
            description: true,
            niveauClasse: true,
            thematiquesPedagogiques: true,
            placesTotales: true,
            hebergements: {
              select: {
                nom: true,
                adresse: true,
                ville: true,
                type: true,
                capacite: true,
              },
              take: 1,
            },
          },
        },
      },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');

    const sejour = autorisation.sejour;
    const hebergement = sejour.hebergements[0] ?? null;

    return {
      eleveNom: autorisation.eleveNom,
      elevePrenom: autorisation.elevePrenom,
      signeeAt: autorisation.signeeAt,
      sejour: {
        titre: sejour.titre,
        lieu: sejour.lieu,
        dateDebut: sejour.dateDebut,
        dateFin: sejour.dateFin,
        description: sejour.description,
        niveauClasse: sejour.niveauClasse,
        thematiquesPedagogiques: sejour.thematiquesPedagogiques,
        placesTotales: sejour.placesTotales,
      },
      hebergement,
    };
  }

  async signer(token: string, dto: SignerAutorisationDto) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { tokenAcces: token },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    if (autorisation.signeeAt)
      throw new ConflictException('Cette autorisation a déjà été signée');

    return this.prisma.autorisationParentale.update({
      where: { tokenAcces: token },
      data: {
        signeeAt: new Date(),
        taille: dto.taille ?? null,
        poids: dto.poids ?? null,
        pointure: dto.pointure ?? null,
        regimeAlimentaire: dto.regimeAlimentaire ?? null,
        niveauSki: dto.niveauSki ?? null,
        infosMedicales: dto.infosMedicales ?? null,
      },
    });
  }

  async getBySejour(sejourId: string, createurId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
    });
    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.createurId !== createurId)
      throw new ForbiddenException('Ce séjour ne vous appartient pas');

    return this.prisma.autorisationParentale.findMany({
      where: { sejourId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
