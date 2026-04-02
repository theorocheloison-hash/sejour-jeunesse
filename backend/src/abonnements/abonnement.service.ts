import { Injectable, NotFoundException } from '@nestjs/common';
import { TypeAbonnement, StatutAbonnement, PlanAbonnement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AbonnementService {
  constructor(private prisma: PrismaService) {}

  async simuler(userId: string, type: TypeAbonnement, plan: PlanAbonnement) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const now = new Date();
    const expiration = new Date(now);
    if (type === TypeAbonnement.MENSUEL) {
      expiration.setMonth(expiration.getMonth() + 1);
    } else {
      expiration.setFullYear(expiration.getFullYear() + 1);
    }

    return this.prisma.centreHebergement.update({
      where: { id: centre.id },
      data: {
        abonnement: type,
        abonnementStatut: StatutAbonnement.ACTIF,
        abonnementActifJusquAu: expiration,
        planAbonnement: plan,
      },
    });
  }

  async getStatut(userId: string) {
    const centre = await this.prisma.centreHebergement.findFirst({
      where: { userId },
      select: {
        abonnement: true,
        abonnementStatut: true,
        abonnementActifJusquAu: true,
        planAbonnement: true,
      },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    return {
      type: centre.abonnement,
      statut: centre.abonnementStatut,
      actifJusquAu: centre.abonnementActifJusquAu,
      plan: centre.planAbonnement,
    };
  }
}
