import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';

const PRIX_ANNUEL_MAP: Record<string, number> = {
  ESSENTIEL: 290,
  COMPLET: 490,
  PILOTAGE: 690,
};

@Injectable()
export class CronAlertesService {
  private readonly logger = new Logger(CronAlertesService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /** Alerte admin J-21/14/7/3/1 avant expiration d'un abonnement actif. */
  async envoyerAlertes() {
    const now = new Date();
    const dans21j = new Date(now); dans21j.setDate(dans21j.getDate() + 21);
    const il_y_a_6j = new Date(now); il_y_a_6j.setDate(il_y_a_6j.getDate() - 6);

    const centres = await this.prisma.centreHebergement.findMany({
      where: {
        abonnementStatut: 'ACTIF',
        abonnementActifJusquAu: { gte: now, lte: dans21j },
        OR: [
          { dernierEmailAlerteAt: null },
          { dernierEmailAlerteAt: { lt: il_y_a_6j } },
        ],
      },
      include: { user: { select: { email: true, prenom: true, nom: true } } },
    });

    let count = 0;
    for (const centre of centres) {
      const exp = centre.abonnementActifJusquAu;
      if (!exp || !centre.user?.email) continue;
      const joursRestants = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
      if (![21, 14, 7, 3, 1].includes(joursRestants)) continue;
      try {
        await this.emailService.sendTrialExpirationAlert(
          centre.nom, centre.user.email, centre.user.prenom, joursRestants, exp,
        );
        await this.prisma.centreHebergement.update({
          where: { id: centre.id },
          data: { dernierEmailAlerteAt: now },
        });
        count++;
      } catch (err) {
        this.logger.error(`[alertes] Erreur centre ${centre.id}`, err as Error);
      }
    }
    return { alertesEnvoyees: count };
  }

  /** Alerte admin pour les essais déjà expirés non convertis (joursRestants = 0). */
  async envoyerAlertesExpires() {
    const now = new Date();
    const il_y_a_6j = new Date(now); il_y_a_6j.setDate(il_y_a_6j.getDate() - 6);

    const centres = await this.prisma.centreHebergement.findMany({
      where: {
        abonnementStatut: 'ACTIF',
        abonnementActifJusquAu: { lt: now },
        trialStartedAt: { not: null },
        mollieMandatId: null,
        OR: [
          { dernierEmailAlerteAt: null },
          { dernierEmailAlerteAt: { lt: il_y_a_6j } },
        ],
      },
      include: { user: { select: { email: true, prenom: true, nom: true } } },
    });

    let count = 0;
    for (const centre of centres) {
      const exp = centre.abonnementActifJusquAu;
      if (!exp || !centre.user?.email) continue;
      try {
        await this.emailService.sendTrialExpirationAlert(
          centre.nom, centre.user.email, centre.user.prenom, 0, exp,
        );
        await this.prisma.centreHebergement.update({
          where: { id: centre.id },
          data: { dernierEmailAlerteAt: now },
        });
        count++;
      } catch (err) {
        this.logger.error(`[alertes-expires] Erreur centre ${centre.id}`, err as Error);
      }
    }
    return { expiresNotifies: count };
  }

  /** Info client : renouvellement annuel à venir (J-30) pour les abonnements payés. */
  async envoyerAlertesRenouvellement() {
    const now = new Date();
    const dans30j = new Date(now); dans30j.setDate(dans30j.getDate() + 30);
    const il_y_a_25j = new Date(now); il_y_a_25j.setDate(il_y_a_25j.getDate() - 25);

    const centres = await this.prisma.centreHebergement.findMany({
      where: {
        abonnement: 'ANNUEL',
        mollieMandatId: { not: null },
        abonnementActifJusquAu: { gte: now, lte: dans30j },
        OR: [
          { dernierEmailAlerteAt: null },
          { dernierEmailAlerteAt: { lt: il_y_a_25j } },
        ],
      },
      include: { user: { select: { email: true, prenom: true, nom: true } } },
    });

    let count = 0;
    for (const centre of centres) {
      const exp = centre.abonnementActifJusquAu;
      if (!exp || !centre.user?.email) continue;
      const dateFmt = exp.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      const prix = PRIX_ANNUEL_MAP[centre.planAbonnement] ?? 0;
      try {
        await this.emailService.sendGenericNotification(
          centre.user.email,
          'Renouvellement de votre abonnement LIAVO',
          `Bonjour ${centre.user.prenom},<br/><br/>Votre abonnement annuel LIAVO sera renouvelé le ${dateFmt}. Montant : ${prix} €.`,
        );
        await this.prisma.centreHebergement.update({
          where: { id: centre.id },
          data: { dernierEmailAlerteAt: now },
        });
        count++;
      } catch (err) {
        this.logger.error(`[renouvellement] Erreur centre ${centre.id}`, err as Error);
      }
    }
    return { renouvellementsNotifies: count };
  }
}
