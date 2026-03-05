import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { CreatePlanningDto } from './dto/create-planning.dto.js';
import { CreateDocumentDto } from './dto/create-document.dto.js';

@Injectable()
export class CollaborationService {
  constructor(private prisma: PrismaService) {}

  /** Vérifie que le séjour est en CONVENTION et que l'utilisateur y a accès */
  async verifyAccess(sejourId: string, userId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      include: {
        hebergementSelectionne: true,
      },
    });

    if (!sejour) throw new NotFoundException('Séjour introuvable');
    if (sejour.statut !== 'CONVENTION') {
      throw new ForbiddenException('Le séjour n\'est pas en statut CONVENTION');
    }

    const isCreateur = sejour.createurId === userId;
    const isVenue = sejour.hebergementSelectionne?.userId === userId;

    if (!isCreateur && !isVenue) {
      throw new ForbiddenException('Vous n\'avez pas accès à cet espace collaboratif');
    }

    return sejour;
  }

  // ── Infos séjour ──────────────────────────────────────────────

  async getSejourInfo(sejourId: string, userId: string) {
    const sejour = await this.verifyAccess(sejourId, userId);

    const full = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      include: {
        createur: { select: { id: true, prenom: true, nom: true, email: true } },
        hebergementSelectionne: { select: { id: true, nom: true, ville: true, userId: true } },
      },
    });

    return full;
  }

  // ── Messages ──────────────────────────────────────────────────

  async getMessages(sejourId: string, userId: string) {
    await this.verifyAccess(sejourId, userId);
    return this.prisma.message.findMany({
      where: { sejourId },
      include: {
        auteur: { select: { id: true, prenom: true, nom: true, role: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createMessage(sejourId: string, userId: string, dto: CreateMessageDto) {
    await this.verifyAccess(sejourId, userId);
    return this.prisma.message.create({
      data: {
        sejourId,
        auteurId: userId,
        contenu: dto.contenu,
      },
      include: {
        auteur: { select: { id: true, prenom: true, nom: true, role: true } },
      },
    });
  }

  // ── Planning ──────────────────────────────────────────────────

  async getPlanning(sejourId: string, userId: string) {
    await this.verifyAccess(sejourId, userId);
    return this.prisma.planningActivite.findMany({
      where: { sejourId },
      orderBy: [{ date: 'asc' }, { heureDebut: 'asc' }],
    });
  }

  async createPlanning(sejourId: string, userId: string, dto: CreatePlanningDto) {
    await this.verifyAccess(sejourId, userId);
    return this.prisma.planningActivite.create({
      data: {
        sejourId,
        date: new Date(dto.date),
        heureDebut: dto.heureDebut,
        heureFin: dto.heureFin,
        titre: dto.titre,
        description: dto.description,
        responsable: dto.responsable,
      },
    });
  }

  async deletePlanning(sejourId: string, userId: string, planningId: string) {
    await this.verifyAccess(sejourId, userId);
    const item = await this.prisma.planningActivite.findUnique({ where: { id: planningId } });
    if (!item || item.sejourId !== sejourId) {
      throw new NotFoundException('Activité introuvable');
    }
    return this.prisma.planningActivite.delete({ where: { id: planningId } });
  }

  // ── Documents ─────────────────────────────────────────────────

  async getDocuments(sejourId: string, userId: string) {
    await this.verifyAccess(sejourId, userId);
    return this.prisma.documentSejour.findMany({
      where: { sejourId },
      include: {
        uploader: { select: { id: true, prenom: true, nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(sejourId: string, userId: string, dto: CreateDocumentDto) {
    await this.verifyAccess(sejourId, userId);
    return this.prisma.documentSejour.create({
      data: {
        sejourId,
        uploaderId: userId,
        nom: dto.nom,
        type: dto.type,
        url: dto.url,
      },
      include: {
        uploader: { select: { id: true, prenom: true, nom: true } },
      },
    });
  }

  // ── Vue hébergeur : mes séjours en convention ─────────────────

  async getMesSejoursConvention(userId: string) {
    const centres = await this.prisma.centreHebergement.findMany({
      where: { userId },
      select: { id: true },
    });
    const centreIds = centres.map((c) => c.id);

    if (centreIds.length === 0) return [];

    return this.prisma.sejour.findMany({
      where: {
        statut: 'CONVENTION',
        hebergementSelectionneId: { in: centreIds },
      },
      include: {
        createur: { select: { prenom: true, nom: true } },
        hebergementSelectionne: { select: { nom: true } },
      },
      orderBy: { dateDebut: 'asc' },
    });
  }
}
