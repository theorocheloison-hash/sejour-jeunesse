import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { getCentreForUser } from '../centres/centre.helper.js';

// Copie du PlanGuard — voir la dette notée sur assertPlanCentreComplet.
const PLAN_HIERARCHY: Record<string, number> = {
  DECOUVERTE: 0,
  ESSENTIEL: 1,
  COMPLET: 2,
  PILOTAGE: 3,
};

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

  // ── Affectation participant→chambre (SC7 lot 2) — geste ORGANISATEUR ─────

  /**
   * Accès rooming : créateur OU accompagnateur à accès collaboratif (lecture ;
   * `requireEdition` exige roleCollaboratif EDITION pour les écritures).
   * DETTE : logique répliquée de collaboration.service.verifyAccess, réduite
   * aux profils atteignables sous @Roles(ORGANISATEUR) — créateur +
   * accompagnateur-collaborateur ; hébergeur/signataire sont déjà exclus par
   * le RolesGuard du controller. Divergence à surveiller si verifyAccess
   * évolue. (Pas d'injection de CollaborationService : cycle de modules
   * chambres↔collaboration.)
   */
  private async resoudreAccesRooming(sejourId: string, userId: string, requireEdition: boolean) {
    if (!sejourId) throw new BadRequestException('Paramètre sejourId requis');
    const sejour = await this.prisma.sejour.findUnique({
      where: { id: sejourId },
      select: {
        id: true,
        createurId: true,
        deletedAt: true,
        hebergementSelectionneId: true,
        hebergementSelectionne: { select: { userId: true } },
      },
    });
    if (!sejour || sejour.deletedAt) throw new NotFoundException('Séjour introuvable');

    if (sejour.createurId === userId) return sejour; // le créateur peut tout

    // L'hébergeur du centre voit le rooming (impression/accueil) mais ne mute
    // pas — les mutations lui sont de toute façon fermées par le @Roles du
    // controller ; ce garde est le filet en lecture.
    if (sejour.hebergementSelectionne?.userId === userId) {
      if (requireEdition) throw new ForbiddenException('Lecture seule pour l\'hébergeur');
      return sejour;
    }

    const accompagnateur = await this.prisma.accompagnateurMission.findFirst({
      where: { sejourId, userId, accesCollaboratif: true },
      select: { roleCollaboratif: true },
    });
    if (!accompagnateur) {
      throw new ForbiddenException('Vous n\'avez pas accès à ce séjour');
    }
    if (requireEdition && accompagnateur.roleCollaboratif !== 'EDITION') {
      throw new ForbiddenException('Accès en lecture seule');
    }
    return sejour;
  }

  /**
   * Gate plan MANUEL : le PlanGuard ne s'applique qu'aux HEBERGEUR (étape 3
   * du guard) — pour un geste ORGANISATEUR, le plan du centre du séjour se
   * vérifie ici. DETTE : calcul du plan effectif copié du PlanGuard §6 →
   * extraire un helper commun un jour.
   */
  private async assertPlanCentreComplet(hebergementSelectionneId: string | null) {
    if (!hebergementSelectionneId) {
      throw new BadRequestException('Ce séjour n\'a pas d\'hébergement sélectionné');
    }
    const centre = await this.prisma.centreHebergement.findUnique({
      where: { id: hebergementSelectionneId },
      select: { abonnementStatut: true, abonnementActifJusquAu: true, planAbonnement: true },
    });
    if (!centre) throw new NotFoundException('Centre introuvable');

    const exp = centre.abonnementActifJusquAu;
    const isActive = centre.abonnementStatut === 'ACTIF' && exp && new Date(exp) >= new Date();
    const effectivePlan = isActive ? (centre.planAbonnement ?? 'DECOUVERTE') : 'DECOUVERTE';
    if ((PLAN_HIERARCHY[effectivePlan] ?? 0) < PLAN_HIERARCHY.COMPLET) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'PLAN_INSUFFICIENT',
        planRequired: 'COMPLET',
        planActuel: effectivePlan,
        message: 'Cette fonctionnalité nécessite le plan Complet.',
      });
    }
  }

  /** GET /chambres/rooming — chambres attribuées + occupants + non-affectés. */
  async getRooming(userId: string, sejourId: string) {
    // LECTURE : un accompagnateur lecture seule voit le rooming.
    // Pas de gate plan en lecture — soft, aligné sur la grille hébergeur (un
    // plan expiré ne doit pas produire un 403 avalé qui fait mentir l'UI
    // « votre hébergeur doit d'abord… ») ; les mutations restent COMPLET.
    await this.resoudreAccesRooming(sejourId, userId, false);

    const [occupations, eleves, encadrants] = await Promise.all([
      this.prisma.occupationChambre.findMany({
        where: { sejourId, source: 'SEJOUR' },
        include: {
          chambre: { include: { lits: { select: { places: true } } } },
          affectations: {
            include: {
              autorisation: { select: { eleveNom: true, elevePrenom: true, signeeAt: true } },
              accompagnateur: { select: { nom: true, prenom: true } },
            },
          },
        },
      }),
      // « Non affecté » = aucune ligne AffectationChambre pour ce séjour
      this.prisma.autorisationParentale.findMany({
        where: { sejourId, affectationsChambre: { none: { sejourId } } },
        select: {
          id: true,
          eleveNom: true,
          elevePrenom: true,
          hebergementCategorie: true,
          signeeAt: true,
        },
        orderBy: [{ eleveNom: 'asc' }, { elevePrenom: 'asc' }],
      }),
      this.prisma.accompagnateurMission.findMany({
        where: { sejourId, affectationsChambre: { none: { sejourId } } },
        select: { id: true, nom: true, prenom: true },
        orderBy: [{ nom: 'asc' }, { prenom: 'asc' }],
      }),
    ]);

    // Tri spatial D13 (étage puis ordre puis nom) — même ordre que la grille.
    const chambres = occupations
      .sort((a, b) => {
        const ea = a.chambre.etage ?? '';
        const eb = b.chambre.etage ?? '';
        if (ea !== eb) return ea.localeCompare(eb);
        if (a.chambre.ordre !== b.chambre.ordre) return a.chambre.ordre - b.chambre.ordre;
        return a.chambre.nom.localeCompare(b.chambre.nom);
      })
      .map((o) => ({
        occupationId: o.id,
        chambreId: o.chambreId,
        nom: o.chambre.nom,
        etage: o.chambre.etage,
        ordre: o.chambre.ordre,
        capacite: o.chambre.lits.reduce((s, l) => s + l.places, 0),
        etiquette: o.etiquette,
        couleur: o.couleur,
        statut: o.statut,
        occupants: o.affectations.map((a) =>
          a.autorisation
            ? {
                affectationId: a.id,
                type: 'ELEVE' as const,
                nom: a.autorisation.eleveNom,
                prenom: a.autorisation.elevePrenom,
                signee: a.autorisation.signeeAt !== null,
              }
            : {
                affectationId: a.id,
                type: 'ENCADRANT' as const,
                nom: a.accompagnateur?.nom ?? '',
                prenom: a.accompagnateur?.prenom ?? '',
                signee: true,
              },
        ),
      }));

    return {
      chambres,
      nonAffectes: {
        eleves: eleves.map((e) => ({
          id: e.id,
          nom: e.eleveNom,
          prenom: e.elevePrenom,
          hebergementCategorie: e.hebergementCategorie,
          signee: e.signeeAt !== null,
        })),
        encadrants,
      },
    };
  }

  /**
   * POST /chambres/affectations — affecter (ou déplacer) un participant vers
   * une chambre attribuée au séjour. Capacité DURE (D7) : refus au-delà de
   * Σ lits.places — l'hébergeur ajoute un lit APPOINT si besoin, pas
   * l'enseignant qui force. D14 : aucune condition sur la signature.
   * litId reste null (V1 : niveau chambre — D13).
   */
  async affecter(
    userId: string,
    sejourId: string,
    chambreId: string,
    body: { autorisationId?: string; accompagnateurId?: string },
  ) {
    const sejour = await this.resoudreAccesRooming(sejourId, userId, true);
    await this.assertPlanCentreComplet(sejour.hebergementSelectionneId);

    if (!chambreId) throw new BadRequestException('chambreId requis');
    const { autorisationId, accompagnateurId } = body;
    if ((autorisationId ? 1 : 0) + (accompagnateurId ? 1 : 0) !== 1) {
      throw new BadRequestException(
        'Fournissez exactement un participant (autorisationId OU accompagnateurId)',
      );
    }

    // Le participant appartient AU séjour (cloisonnement — le FK composite en
    // base est le filet ultime, ici l'erreur parlante).
    if (autorisationId) {
      const autorisation = await this.prisma.autorisationParentale.findUnique({
        where: { id: autorisationId },
        select: { sejourId: true },
      });
      if (!autorisation || autorisation.sejourId !== sejourId) {
        throw new NotFoundException('Participant introuvable dans ce séjour');
      }
    } else if (accompagnateurId) {
      const acc = await this.prisma.accompagnateurMission.findUnique({
        where: { id: accompagnateurId },
        select: { sejourId: true },
      });
      if (!acc || acc.sejourId !== sejourId) {
        throw new NotFoundException('Encadrant introuvable dans ce séjour');
      }
    }

    const occupation = await this.prisma.occupationChambre.findFirst({
      where: { chambreId, sejourId, source: 'SEJOUR' },
      include: { chambre: { include: { lits: { select: { places: true } } } } },
    });
    if (!occupation) {
      throw new BadRequestException('Chambre non attribuée à ce séjour');
    }
    const capacite = occupation.chambre.lits.reduce((s, l) => s + l.places, 0);

    // Count + écriture dans la MÊME transaction (course capacité).
    return this.prisma.$transaction(async (tx) => {
      // @@unique nullable → findFirst (pas de findUnique composite avec null)
      const existante = await tx.affectationChambre.findFirst({
        where: autorisationId ? { sejourId, autorisationId } : { sejourId, accompagnateurId },
      });
      if (existante && existante.occupationId === occupation.id) {
        return existante; // re-drop sur la même chambre → no-op
      }

      const occupes = await tx.affectationChambre.count({
        where: { occupationId: occupation.id },
      });
      if (occupes >= capacite) {
        throw new ConflictException('Capacité de la chambre atteinte');
      }

      if (existante) {
        // MOVE : l'affectation change d'occupation ; changer de chambre
        // invalide le lit éventuel.
        return tx.affectationChambre.update({
          where: { id: existante.id },
          data: { occupationId: occupation.id, litId: null },
        });
      }
      return tx.affectationChambre.create({
        data: {
          occupationId: occupation.id,
          sejourId,
          autorisationId: autorisationId ?? null,
          accompagnateurId: accompagnateurId ?? null,
          litId: null,
        },
      });
    });
  }

  /** DELETE /chambres/affectations/:id — retirer un participant de sa chambre. */
  async retirer(userId: string, affectationId: string) {
    const affectation = await this.prisma.affectationChambre.findUnique({
      where: { id: affectationId },
      select: { id: true, sejourId: true },
    });
    if (!affectation) throw new NotFoundException('Affectation introuvable');
    await this.resoudreAccesRooming(affectation.sejourId, userId, true);

    await this.prisma.affectationChambre.delete({ where: { id: affectationId } });
    return { deleted: true as const };
  }
}
