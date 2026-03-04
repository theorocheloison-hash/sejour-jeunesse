import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { StatutAbonnement, StatutDevis } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateDevisDto } from './dto/create-devis.dto.js';

@Injectable()
export class DevisService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDevisDto, userId: string) {
    // Vérifier abonnement actif
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');
    if (centre.abonnementStatut !== StatutAbonnement.ACTIF) {
      throw new ForbiddenException('Abonnement inactif');
    }

    // Vérifier que la demande est ouverte
    const demande = await this.prisma.demandeDevis.findUnique({
      where: { id: dto.demandeId },
    });
    if (!demande) throw new NotFoundException('Demande introuvable');
    if (demande.statut !== 'OUVERTE') {
      throw new ForbiddenException('Cette demande n\'est plus ouverte');
    }

    return this.prisma.devis.create({
      data: {
        demandeId: dto.demandeId,
        centreId: centre.id,
        montantTotal: dto.montantTotal,
        montantParEleve: dto.montantParEleve,
        description: dto.description,
        conditionsAnnulation: dto.conditionsAnnulation,
      },
    });
  }

  async getMesDevis(userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    return this.prisma.devis.findMany({
      where: { centreId: centre.id },
      include: {
        demande: {
          include: {
            enseignant: { select: { prenom: true, nom: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDevisForDemande(demandeId: string, user: { id: string; role: string }) {
    // Si c'est un enseignant, vérifier qu'il est propriétaire de la demande
    if (user.role === 'TEACHER') {
      const demande = await this.prisma.demandeDevis.findUnique({
        where: { id: demandeId },
      });
      if (!demande || demande.enseignantId !== user.id) {
        throw new ForbiddenException('Accès refusé');
      }
    }

    return this.prisma.devis.findMany({
      where: { demandeId },
      include: {
        centre: { select: { id: true, nom: true, ville: true, capacite: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateStatut(id: string, statut: StatutDevis, userId: string) {
    const devis = await this.prisma.devis.findUnique({
      where: { id },
      include: { demande: true },
    });
    if (!devis) throw new NotFoundException('Devis introuvable');
    if (devis.demande.enseignantId !== userId) {
      throw new ForbiddenException('Accès refusé');
    }

    return this.prisma.devis.update({
      where: { id },
      data: { statut },
    });
  }
}
