import { Injectable, NotFoundException } from '@nestjs/common';
import { TypeAbonnement, StatutAbonnement, PlanAbonnement } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';

@Injectable()
export class AbonnementService {
  constructor(private prisma: PrismaService) {}

  async simuler(userId: string, type: TypeAbonnement, plan: PlanAbonnement, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

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

  async getStatut(userId: string, centreId?: string | null) {
    const centre = await getCentreForUser(this.prisma, userId, centreId);

    const now = new Date();
    const expiration = centre.abonnementActifJusquAu;
    const essaiActif =
      centre.abonnementStatut === 'ACTIF' &&
      centre.planAbonnement === 'COMPLET' &&
      !!expiration &&
      expiration >= now;
    const joursRestants =
      essaiActif && expiration
        ? Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : 0;

    return {
      type: centre.abonnement,
      statut: centre.abonnementStatut,
      actifJusquAu: centre.abonnementActifJusquAu,
      plan: centre.planAbonnement,
      essaiActif,
      joursRestants,
    };
  }
}
