import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StatutAbonnement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDemandeDto } from './dto/create-demande.dto.js';

@Injectable()
export class DemandeService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDemandeDto, enseignantId: string) {
    return this.prisma.demandeDevis.create({
      data: {
        titre: dto.titre,
        description: dto.description,
        dateDebut: new Date(dto.dateDebut),
        dateFin: new Date(dto.dateFin),
        nombreEleves: dto.nombreEleves,
        villeHebergement: dto.villeHebergement,
        regionCible: dto.regionCible ?? '',
        dateButoireReponse: dto.dateButoireReponse ? new Date(dto.dateButoireReponse) : null,
        sejourId: dto.sejourId,
        enseignantId,
      },
    });
  }

  async findOpen(userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (centre.abonnementStatut !== StatutAbonnement.ACTIF) {
      throw new ForbiddenException('Abonnement inactif — activez votre abonnement pour voir les demandes');
    }

    return this.prisma.demandeDevis.findMany({
      where: {
        statut: 'OUVERTE',
        AND: [
          // Région : la demande correspond à la région du centre OU pas de filtre région
          {
            OR: [
              { regionCible: centre.ville },
              { regionCible: '' },
            ],
          },
          // Date butoire : pas de date OU pas encore dépassée
          {
            OR: [
              { dateButoireReponse: null },
              { dateButoireReponse: { gte: new Date() } },
            ],
          },
        ],
      },
      include: {
        enseignant: { select: { id: true, prenom: true, nom: true, email: true } },
        sejour: { select: { niveauClasse: true, thematiquesPedagogiques: true } },
        _count: { select: { devis: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getMesDemandes(enseignantId: string) {
    return this.prisma.demandeDevis.findMany({
      where: { enseignantId },
      include: {
        _count: { select: { devis: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const demande = await this.prisma.demandeDevis.findUnique({
      where: { id },
      include: {
        enseignant: { select: { id: true, prenom: true, nom: true, email: true } },
        devis: {
          include: {
            centre: { select: { id: true, nom: true, ville: true, email: true, capacite: true } },
          },
        },
      },
    });
    if (!demande) throw new NotFoundException('Demande introuvable');
    return demande;
  }

  async getComparatif(demandeId: string, user: { id: string; role: string }) {
    const demande = await this.prisma.demandeDevis.findUnique({
      where: { id: demandeId },
    });
    if (!demande) throw new NotFoundException('Demande introuvable');

    if (user.role === 'TEACHER' && demande.enseignantId !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }

    return this.prisma.devis.findMany({
      where: { demandeId },
      include: {
        centre: {
          select: { id: true, nom: true, ville: true, email: true, capacite: true, description: true },
        },
      },
      orderBy: { montantTotal: 'asc' },
    });
  }
}
