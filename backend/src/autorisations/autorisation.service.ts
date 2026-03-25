import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { StorageService } from '../storage/storage.service.js';
import { CreateAutorisationDto } from './dto/create-autorisation.dto.js';
import { SignerAutorisationDto } from './dto/signer-autorisation.dto.js';

const FRONTEND_URL = process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:3000';

@Injectable()
export class AutorisationService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private storage: StorageService,
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
            prix: true,
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
            demandes: {
              select: {
                devis: {
                  where: { statut: 'SELECTIONNE' },
                  select: { montantParEleve: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');

    const sejour = autorisation.sejour;
    const hebergement = sejour.hebergements[0] ?? null;

    // Find montantParEleve from selected devis
    const devisSelectionne = sejour.demandes
      ?.flatMap((d) => d.devis)
      .find((dv) => dv);
    const montantParEleve = devisSelectionne?.montantParEleve
      ?? (Number(sejour.prix) > 0 ? String(sejour.prix) : null);

    return {
      eleveNom: autorisation.eleveNom,
      elevePrenom: autorisation.elevePrenom,
      signeeAt: autorisation.signeeAt,
      attestationAssuranceUrl: autorisation.attestationAssuranceUrl,
      sejour: {
        titre: sejour.titre,
        lieu: sejour.lieu,
        dateDebut: sejour.dateDebut,
        dateFin: sejour.dateFin,
        description: sejour.description,
        niveauClasse: sejour.niveauClasse,
        thematiquesPedagogiques: sejour.thematiquesPedagogiques,
        placesTotales: sejour.placesTotales,
        montantParEleve,
      },
      hebergement,
    };
  }

  async signer(token: string, dto: SignerAutorisationDto, ipAddress?: string) {
    if (!dto.rgpdAccepte) {
      throw new BadRequestException(
        'Vous devez accepter les conditions de traitement des données personnelles (RGPD).',
      );
    }

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
        signatureIpAddress: ipAddress ?? null,
        signatureHash: createHash('sha256')
          .update(`${autorisation.id}${token}${new Date().toISOString()}`)
          .digest('hex'),
        taille: dto.taille ?? null,
        poids: dto.poids ?? null,
        pointure: dto.pointure ?? null,
        regimeAlimentaire: dto.regimeAlimentaire ?? null,
        niveauSki: dto.niveauSki ?? null,
        infosMedicales: dto.infosMedicales ?? null,
        nomParent: dto.nomParent ?? null,
        telephoneUrgence: dto.telephoneUrgence ?? null,
        eleveDateNaissance: dto.eleveDateNaissance ? new Date(dto.eleveDateNaissance) : null,
        rgpdAccepte: true,
        rgpdAccepteAt: new Date(),
        rgpdVersionCgu: process.env.CGU_VERSION ?? '1.0',
        consentementMedical: dto.consentementMedical ?? false,
        consentementMedicalAt: dto.consentementMedical ? new Date() : null,
        nombreMensualites: dto.nombreMensualites ?? 1,
        moyenPaiement: dto.moyenPaiement ?? null,
      },
    });
  }

  async uploadDocumentMedical(token: string, file: Express.Multer.File, type?: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { tokenAcces: token },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');

    const isAssurance = type === 'assurance';
    const folder = isAssurance ? 'attestations-assurance' : 'documents-medicaux';
    const url = await this.storage.upload(file, folder);

    return this.prisma.autorisationParentale.update({
      where: { tokenAcces: token },
      data: isAssurance ? { attestationAssuranceUrl: url } : { documentMedicalUrl: url },
    });
  }

  async validerPaiement(autorisationId: string, userId: string) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { id: autorisationId },
      include: { sejour: { select: { createurId: true } } },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');

    return this.prisma.autorisationParentale.update({
      where: { id: autorisationId },
      data: {
        paiementValide: true,
        datePaiement: new Date(),
      },
    });
  }

  async validerPaiementPartiel(autorisationId: string, montant: number) {
    const autorisation = await this.prisma.autorisationParentale.findUnique({
      where: { id: autorisationId },
    });
    if (!autorisation) throw new NotFoundException('Autorisation introuvable');
    if (autorisation.paiementValide) {
      throw new ConflictException('Le paiement est déjà totalement validé');
    }

    const nouveauMontantVerse = (autorisation.montantVerseTotal ?? 0) + montant;
    const nouveauNombreVersements = (autorisation.nombreVersementsEffectues ?? 0) + 1;

    return this.prisma.autorisationParentale.update({
      where: { id: autorisationId },
      data: {
        montantVerseTotal: nouveauMontantVerse,
        nombreVersementsEffectues: nouveauNombreVersements,
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
