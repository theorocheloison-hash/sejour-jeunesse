import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';

/**
 * Rooming (sous-chantier 7) — foyer du geste collab chambres : stats de
 * dimensionnement par catégorie d'hébergement (ce lot), affectation
 * participant→chambre (lot suivant).
 */
@Injectable()
export class RoomingService {
  constructor(private prisma: PrismaService) {}

  /**
   * Séjour du centre ou 404/403 — DETTE : 3e copie de ce gate (occupations.
   * service, capacite.service, ici) → extraire un helper commun un jour.
   */
  private async getSejourDuCentre(sejourId: string, centreId: string) {
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: { id: true, deletedAt: true, hebergementSelectionneId: true },
    });
    if (!sejour || sejour.deletedAt) throw new NotFoundException('Séjour introuvable');
    if (sejour.hebergementSelectionneId !== centreId) {
      throw new ForbiddenException('Ce séjour ne vous appartient pas');
    }
    return sejour;
  }

  /**
   * Compteur par catégorie d'hébergement — TOUS les élèves saisis, aucun
   * filtre signeeAt (la répartition se prépare avant les signatures).
   */
  async getRoomingStats(
    userId: string,
    centreId: string | null | undefined,
    sejourId: string,
  ) {
    // Sans ce garde, un sejourId absent finirait en findUnique({ id: undefined })
    // → 500 Prisma brut au lieu d'un 400 parlant.
    if (!sejourId) throw new BadRequestException('Paramètre sejourId requis');

    const centre = await getCentreForUser(this.prisma, userId, centreId);
    await this.getSejourDuCentre(sejourId, centre.id);

    const [groupes, encadrants] = await Promise.all([
      this.prisma.autorisationParentale.groupBy({
        by: ['hebergementCategorie'],
        where: { sejourId },
        _count: { _all: true },
      }),
      this.prisma.accompagnateurMission.count({ where: { sejourId } }),
    ]);

    let filles = 0;
    let garcons = 0;
    let autre = 0;
    let aCategoriser = 0;
    for (const g of groupes) {
      const n = g._count._all;
      if (g.hebergementCategorie === 'FILLE') filles = n;
      else if (g.hebergementCategorie === 'GARCON') garcons = n;
      else if (g.hebergementCategorie === 'AUTRE') autre = n;
      // null — et toute valeur inattendue — reste à catégoriser
      else aCategoriser += n;
    }

    return {
      elevesTotal: filles + garcons + autre + aCategoriser,
      filles,
      garcons,
      autre,
      aCategoriser,
      encadrants,
    };
  }
}
