import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { montantRecurrentOrganisationCents } from './montant-organisation.helper.js';

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

    // L3b : l'abonnement est porté par l'ORGANISATION — le cron itère les orgs.
    // Une org = un abo = une itération : le regroupement 4.20 par userId est
    // obsolète (il n'existait que pour dédupliquer N centres d'un même compte).
    const orgs = await this.prisma.organisation.findMany({
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
      include: {
        // Centres exploités (ACTIVE + revendiqués) : destinataire + noms du mail.
        centresHebergement: {
          where: { statut: 'ACTIVE', userId: { not: null } },
          include: { user: { select: { email: true, prenom: true, nom: true } } },
        },
      },
    });

    let count = 0;
    for (const org of orgs) {
      const exp = org.abonnementActifJusquAu;
      if (!exp) continue;
      const centresExploites = org.centresHebergement;
      if (centresExploites.length === 0) continue; // org sans centre exploité = pas de destinataire
      const premier = centresExploites[0];
      if (!premier?.user?.email) continue;
      const joursRestants = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
      if (![21, 14, 7, 3, 1].includes(joursRestants)) continue;
      const noms = centresExploites.map((c) => c.nom).join(', ');
      try {
        await this.emailService.sendTrialExpirationAlert(
          noms, premier.user!.email, premier.user!.prenom, joursRestants, exp,
        );
        // Tampon posé sur l'org SEULE (unique porteur du champ), après envoi réussi.
        await this.prisma.organisation.update({
          where: { id: org.id },
          data: { dernierEmailAlerteAt: now },
        });
        count++;
      } catch (err) {
        this.logger.error(`[alertes] Erreur organisation ${org.id}`, err as Error);
      }
    }
    return { alertesEnvoyees: count };
  }

  /**
   * Relance HÉBERGEUR (sendTrialExpirationAlert, joursRestants = 0) pour les
   * essais déjà expirés non convertis.
   */
  async envoyerAlertesExpires() {
    const now = new Date();
    const il_y_a_6j = new Date(now); il_y_a_6j.setDate(il_y_a_6j.getDate() - 6);
    const il_y_a_15j = new Date(now); il_y_a_15j.setDate(il_y_a_15j.getDate() - 15);

    // L3b : itération par organisation (une org = un abo), regroupement 4.20 obsolète.
    const orgs = await this.prisma.organisation.findMany({
      where: {
        abonnementStatut: 'ACTIF',
        // Fenêtre de relance bornée (décision 18/08) : ~2 emails max
        // post-expiration (J0 puis ~J+6 via le tampon 6j), puis silence
        // définitif — sans borne, une org expirée non convertie recevait un
        // email tous les 6 jours indéfiniment (rien ne bascule jamais
        // abonnementStatut en INACTIF).
        abonnementActifJusquAu: { lt: now, gte: il_y_a_15j },
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
      include: {
        centresHebergement: {
          where: { statut: 'ACTIVE', userId: { not: null } },
          include: { user: { select: { email: true, prenom: true, nom: true } } },
        },
      },
    });

    let count = 0;
    for (const org of orgs) {
      const exp = org.abonnementActifJusquAu;
      if (!exp) continue;
      const centresExploites = org.centresHebergement;
      if (centresExploites.length === 0) continue; // org sans centre exploité = pas de destinataire
      const premier = centresExploites[0];
      if (!premier?.user?.email) continue;
      const noms = centresExploites.map((c) => c.nom).join(', ');
      try {
        await this.emailService.sendTrialExpirationAlert(
          noms, premier.user!.email, premier.user!.prenom, 0, exp,
        );
        await this.prisma.organisation.update({
          where: { id: org.id },
          data: { dernierEmailAlerteAt: now },
        });
        count++;
      } catch (err) {
        this.logger.error(`[alertes-expires] Erreur organisation ${org.id}`, err as Error);
      }
    }
    return { expiresNotifies: count };
  }

  /** Info client : renouvellement annuel à venir (J-30) pour les abonnements payés. */
  async envoyerAlertesRenouvellement() {
    const now = new Date();
    const dans30j = new Date(now); dans30j.setDate(dans30j.getDate() + 30);
    const il_y_a_25j = new Date(now); il_y_a_25j.setDate(il_y_a_25j.getDate() - 25);

    // L3b : itération par organisation (une org = un abo).
    const orgs = await this.prisma.organisation.findMany({
      where: {
        abonnement: 'ANNUEL',
        mollieMandatId: { not: null },
        abonnementActifJusquAu: { gte: now, lte: dans30j },
        OR: [
          { dernierEmailAlerteAt: null },
          { dernierEmailAlerteAt: { lt: il_y_a_25j } },
        ],
      },
      include: {
        centresHebergement: {
          where: { statut: 'ACTIVE', userId: { not: null } },
          include: { user: { select: { email: true, prenom: true, nom: true } } },
        },
      },
    });

    let count = 0;
    for (const org of orgs) {
      const exp = org.abonnementActifJusquAu;
      if (!exp) continue;
      const centresExploites = org.centresHebergement;
      if (centresExploites.length === 0) continue; // org sans centre exploité = pas de destinataire
      const premier = centresExploites[0];
      if (!premier?.user?.email) continue;
      const dateFmt = exp.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      // 10.5 : le mail annonce le montant RÉELLEMENT prélevé (plan + supplément
      // par centre exploité). Via le point de calcul unique — le where a filtré
      // abonnement 'ANNUEL', donc la fréquence lue par le helper est bien annuelle.
      // Le helper refait un count (statut ACTIVE + userId non null) : même filtre
      // que l'include ci-dessus → même nombre que centresExploites.length.
      const prix = (await montantRecurrentOrganisationCents(this.prisma, org.id)) / 100;
      try {
        await this.emailService.sendGenericNotification(
          premier.user.email,
          'Renouvellement de votre abonnement LIAVO',
          `Bonjour ${premier.user.prenom},<br/><br/>Votre abonnement annuel LIAVO sera renouvelé le ${dateFmt}. Montant : ${prix} €.`,
        );
        await this.prisma.organisation.update({
          where: { id: org.id },
          data: { dernierEmailAlerteAt: now },
        });
        count++;
      } catch (err) {
        this.logger.error(`[renouvellement] Erreur organisation ${org.id}`, err as Error);
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

    // L3b : itération par organisation (une org = un abo). Destinataire = admin,
    // les centres exploités ne servent qu'aux noms du mail.
    const orgs = await this.prisma.organisation.findMany({
      where: {
        modePaiement: 'VIREMENT',
        abonnementStatut: 'ACTIF',
        abonnementActifJusquAu: { gte: now, lte: dans30j },
        OR: [
          { dernierEmailAlerteAt: null },
          { dernierEmailAlerteAt: { lt: il_y_a_25j } },
        ],
      },
      include: {
        centresHebergement: {
          where: { statut: 'ACTIVE', userId: { not: null } },
          select: { nom: true },
        },
      },
    });

    const adminEmail = process.env.ADMIN_ALERT_EMAIL ?? 'contact@liavo.fr';
    let count = 0;
    for (const org of orgs) {
      const exp = org.abonnementActifJusquAu;
      if (!exp) continue;
      const centresExploites = org.centresHebergement;
      if (centresExploites.length === 0) continue; // pas de relance sans nom de centre
      const noms = centresExploites.map((c) => c.nom).join(', ');
      const dateFmt = exp.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
      try {
        await this.emailService.sendGenericNotification(
          adminEmail,
          'Renouvellement virement à préparer',
          `Le centre ${noms} (abonnement ${org.planAbonnement}) expire le ${dateFmt}. Pense à ré-émettre la facture virement/BdC.`,
        );
        await this.prisma.organisation.update({
          where: { id: org.id },
          data: { dernierEmailAlerteAt: now },
        });
        count++;
      } catch (err) {
        this.logger.error(`[relance-virement] Erreur organisation ${org.id}`, err as Error);
      }
    }
    return { relancesVirementNotifiees: count };
  }
}
