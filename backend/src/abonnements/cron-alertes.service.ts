import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { calculerMontantAbonnementCents } from './abonnement.constants.js';

@Injectable()
export class CronAlertesService {
  private readonly logger = new Logger(CronAlertesService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  /**
   * Point d'entrée cron quotidien (8h Europe/Paris, in-process via @nestjs/schedule —
   * mono-dyno Scalingo, pas de process clock séparé).
   * GARDE : ne s'exécute que si ENABLE_CRON === 'true'. Cette variable doit être
   * posée à 'true' sur Scalingo UNIQUEMENT — jamais en local ni en CI, pour éviter
   * les envois d'emails d'alerte depuis un environnement de développement.
   * Chaque étape a son propre try/catch : un échec n'empêche pas la suivante.
   */
  @Cron('0 8 * * *', { timeZone: 'Europe/Paris' })
  async cronQuotidien() {
    if (process.env.ENABLE_CRON !== 'true') return;

    try {
      const { alertesEnvoyees } = await this.envoyerAlertes();
      this.logger.log(`[cronQuotidien] alertes expiration : ${alertesEnvoyees} envoyée(s)`);
    } catch (err) {
      this.logger.error('[cronQuotidien] échec envoyerAlertes', err as Error);
    }

    try {
      const { expiresNotifies } = await this.envoyerAlertesExpires();
      this.logger.log(`[cronQuotidien] essais expirés : ${expiresNotifies} notifié(s)`);
    } catch (err) {
      this.logger.error('[cronQuotidien] échec envoyerAlertesExpires', err as Error);
    }

    try {
      const { renouvellementsNotifies } = await this.envoyerAlertesRenouvellement();
      this.logger.log(`[cronQuotidien] renouvellements annuels : ${renouvellementsNotifies} notifié(s)`);
    } catch (err) {
      this.logger.error('[cronQuotidien] échec envoyerAlertesRenouvellement', err as Error);
    }

    try {
      const { relancesVirementNotifiees } = await this.envoyerRelanceVirement();
      this.logger.log(`[cronQuotidien] relances virement admin : ${relancesVirementNotifiees} notifiée(s)`);
    } catch (err) {
      this.logger.error('[cronQuotidien] échec envoyerRelanceVirement', err as Error);
    }
  }

  /**
   * Alerte J-21/14/7/3/1 avant expiration d'un ESSAI actif (trial démarré,
   * pas de mandat Mollie — même ciblage qu'envoyerAlertesExpires : le message
   * envoyé est sendTrialExpirationAlert, il ne concerne pas les abonnements payés).
   */
  async envoyerAlertes() {
    const now = new Date();
    const dans21j = new Date(now); dans21j.setDate(dans21j.getDate() + 21);
    const il_y_a_6j = new Date(now); il_y_a_6j.setDate(il_y_a_6j.getDate() - 6);

    const centres = await this.prisma.centreHebergement.findMany({
      where: {
        abonnementStatut: 'ACTIF',
        abonnementActifJusquAu: { gte: now, lte: dans21j },
        trialStartedAt: { not: null },
        mollieMandatId: null,
        OR: [
          { dernierEmailAlerteAt: null },
          { dernierEmailAlerteAt: { lt: il_y_a_6j } },
        ],
        // Clients payés par virement/BdC (ex. Choucas) : trialStartedAt résiduel
        // sans mandat Mollie — à exclure des alertes d'essai. Null-safe : un
        // `not: 'VIREMENT'` seul exclurait les NULL (vrais essais).
        AND: [
          { OR: [{ modePaiement: null }, { modePaiement: { not: 'VIREMENT' } }] },
        ],
      },
      include: { user: { select: { email: true, prenom: true, nom: true } } },
    });

    // 4.20 : les centres d'un même compte partagent la même date de fin (alignement
    // trial 14/07) → une alerte admin PAR centre le même jour. Regroupement par
    // userId + palier : UN mail par compte, noms de centres joints. Clé de repli
    // centre.id si userId absent (comportement par-centre conservé).
    type CentreAlerte = (typeof centres)[number];
    const groupes = new Map<string, { centres: CentreAlerte[]; joursRestants: number; exp: Date }>();
    for (const centre of centres) {
      const exp = centre.abonnementActifJusquAu;
      if (!exp || !centre.user?.email) continue;
      const joursRestants = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
      if (![21, 14, 7, 3, 1].includes(joursRestants)) continue;
      const cle = `${centre.userId ?? centre.id}|${joursRestants}`;
      const groupe = groupes.get(cle);
      if (groupe) groupe.centres.push(centre);
      else groupes.set(cle, { centres: [centre], joursRestants, exp });
    }

    let count = 0;
    for (const groupe of groupes.values()) {
      const premier = groupe.centres[0];
      const noms = groupe.centres.map((c) => c.nom).join(', ');
      try {
        await this.emailService.sendTrialExpirationAlert(
          noms, premier.user!.email, premier.user!.prenom, groupe.joursRestants, groupe.exp,
        );
        // Tampon posé centre par centre (pas d'updateMany) : ne s'applique qu'après envoi réussi.
        for (const centre of groupe.centres) {
          await this.prisma.centreHebergement.update({
            where: { id: centre.id },
            data: { dernierEmailAlerteAt: now },
          });
        }
        count++;
      } catch (err) {
        this.logger.error(`[alertes] Erreur groupe ${premier.id}`, err as Error);
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
        // Même exclusion null-safe des clients virement que envoyerAlertes.
        AND: [
          { OR: [{ modePaiement: null }, { modePaiement: { not: 'VIREMENT' } }] },
        ],
      },
      include: { user: { select: { email: true, prenom: true, nom: true } } },
    });

    // 4.20 : même regroupement par compte que envoyerAlertes (palier unique 0).
    type CentreExpire = (typeof centres)[number];
    const groupes = new Map<string, { centres: CentreExpire[]; exp: Date }>();
    for (const centre of centres) {
      const exp = centre.abonnementActifJusquAu;
      if (!exp || !centre.user?.email) continue;
      const cle = centre.userId ?? centre.id;
      const groupe = groupes.get(cle);
      if (groupe) groupe.centres.push(centre);
      else groupes.set(cle, { centres: [centre], exp });
    }

    let count = 0;
    for (const groupe of groupes.values()) {
      const premier = groupe.centres[0];
      const noms = groupe.centres.map((c) => c.nom).join(', ');
      try {
        await this.emailService.sendTrialExpirationAlert(
          noms, premier.user!.email, premier.user!.prenom, 0, groupe.exp,
        );
        for (const centre of groupe.centres) {
          await this.prisma.centreHebergement.update({
            where: { id: centre.id },
            data: { dernierEmailAlerteAt: now },
          });
        }
        count++;
      } catch (err) {
        this.logger.error(`[alertes-expires] Erreur groupe ${premier.id}`, err as Error);
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
      // 10.5 : même formule que la souscription et le webhook Mollie — plan +
      // supplément par centre ACTIF au-delà du premier (le prélèvement réel
      // inclut ce supplément, le mail doit annoncer le même montant).
      const nbCentresActifs = centre.userId
        ? await this.prisma.centreHebergement.count({
            where: { userId: centre.userId, statut: 'ACTIVE' },
          })
        : 1;
      const prix = calculerMontantAbonnementCents(centre.planAbonnement, 'ANNUEL', nbCentresActifs) / 100;
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

  /**
   * Rappel ADMIN J-30 : renouvellement à préparer pour les clients virement/BdC
   * (10.1b-4). La facture est manuelle (facturerCentre) — l'admin doit la
   * ré-émettre avant l'expiration. Ciblage exclusif modePaiement VIREMENT :
   * ces centres sont exclus des alertes d'essai (10.1a) et n'ont jamais de
   * mandat Mollie (donc jamais dans envoyerAlertesRenouvellement) — aucun
   * conflit sur le tampon partagé dernierEmailAlerteAt.
   */
  async envoyerRelanceVirement() {
    const now = new Date();
    const dans30j = new Date(now); dans30j.setDate(dans30j.getDate() + 30);
    const il_y_a_25j = new Date(now); il_y_a_25j.setDate(il_y_a_25j.getDate() - 25);

    const centres = await this.prisma.centreHebergement.findMany({
      where: {
        modePaiement: 'VIREMENT',
        abonnementStatut: 'ACTIF',
        abonnementActifJusquAu: { gte: now, lte: dans30j },
        OR: [
          { dernierEmailAlerteAt: null },
          { dernierEmailAlerteAt: { lt: il_y_a_25j } },
        ],
      },
    });

    const adminEmail = process.env.ADMIN_ALERT_EMAIL ?? 'contact@liavo.fr';
    let count = 0;
    for (const centre of centres) {
      const exp = centre.abonnementActifJusquAu;
      if (!exp) continue;
      const dateFmt = exp.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      try {
        await this.emailService.sendGenericNotification(
          adminEmail,
          'Renouvellement virement à préparer',
          `Le centre ${centre.nom} (abonnement ${centre.planAbonnement}) expire le ${dateFmt}. Pense à ré-émettre la facture virement/BdC.`,
        );
        await this.prisma.centreHebergement.update({
          where: { id: centre.id },
          data: { dernierEmailAlerteAt: now },
        });
        count++;
      } catch (err) {
        this.logger.error(`[relance-virement] Erreur centre ${centre.id}`, err as Error);
      }
    }
    return { relancesVirementNotifiees: count };
  }
}
