import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';

const DELAI_RELANCE_DEVIS_JOURS = 20;
const INTERVALLE_RELANCE_JOURS = 7;
const DELAI_RELANCE_HEBERGEUR_JOURS = 30;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Europe/Paris' })
  async envoyerRappelsVeille() {
    this.logger.log('[CRON] Déclenchement rappels-veille');

    const demain = new Date();
    demain.setDate(demain.getDate() + 1);
    const debutDemain = new Date(demain.getFullYear(), demain.getMonth(), demain.getDate());
    const finDemain = new Date(demain.getFullYear(), demain.getMonth(), demain.getDate() + 1);

    const rappels = await this.prisma.rappel.findMany({
      where: {
        dateEcheance: { gte: debutDemain, lt: finDemain },
        statut: 'A_FAIRE',
        notifiedAt: null,
      },
      include: {
        client: {
          include: {
            centre: {
              include: {
                user: { select: { email: true, prenom: true, nom: true } },
              },
            },
          },
        },
      },
    });

    this.logger.log(`[CRON] ${rappels.length} rappel(s) à notifier pour demain`);

    for (const rappel of rappels) {
      const userEmail = rappel.client?.centre?.user?.email;
      if (!userEmail) continue;

      const dateFormatee = new Date(rappel.dateEcheance).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });

      try {
        await this.email.sendGenericNotification(
          userEmail,
          `Rappel demain — ${rappel.type} : ${rappel.client.nom}`,
          `<p>Bonjour,</p>
           <p>Vous avez un rappel prévu <strong>demain ${dateFormatee}</strong> pour le client <strong>${rappel.client.nom}</strong> :</p>
           <table style="width:100%;border-collapse:collapse;margin:16px 0">
             <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Type</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${rappel.type}</td></tr>
             <tr><td style="padding:8px 12px;font-size:13px;color:#666">Description</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${rappel.description}</td></tr>
           </table>
           <p>Connectez-vous à LIAVO pour marquer ce rappel comme traité.</p>`,
        );

        await this.prisma.rappel.update({
          where: { id: rappel.id },
          data: { notifiedAt: new Date() },
        });

        this.logger.log(`[CRON] Rappel notifié — id: ${rappel.id}, client: ${rappel.client.nom}`);
      } catch (err) {
        this.logger.error(`[CRON] Échec notification rappel ${rappel.id}`, err);
      }
    }
  }

  @Cron('30 8 * * *', { timeZone: 'Europe/Paris' })
  async relancerDevisEnAttente() {
    this.logger.log('[CRON] Déclenchement relance-devis');

    const seuilRelance = new Date();
    seuilRelance.setDate(seuilRelance.getDate() - DELAI_RELANCE_DEVIS_JOURS);

    const seuilIntervalle = new Date();
    seuilIntervalle.setDate(seuilIntervalle.getDate() - INTERVALLE_RELANCE_JOURS);

    const devis = await this.prisma.devis.findMany({
      where: {
        statut: 'EN_ATTENTE',
        createdAt: { lte: seuilRelance },
        OR: [
          { relanceEnvoyeeAt: null },
          { relanceEnvoyeeAt: { lte: seuilIntervalle } },
        ],
      },
      include: {
        centre: {
          include: {
            user: { select: { email: true } },
          },
        },
        demande: {
          include: {
            enseignant: { select: { prenom: true, nom: true, email: true } },
            sejour: { select: { titre: true, dateDebut: true } },
          },
        },
      },
    });

    this.logger.log(`[CRON] ${devis.length} devis EN_ATTENTE à relancer`);

    for (const d of devis) {
      const enseignantEmail = d.demande?.enseignant?.email;
      const sejourTitre = d.demande?.sejour?.titre ?? 'votre séjour';
      const centreNom = d.centre?.nom ?? "l'hébergeur";
      const enseignantPrenom = d.demande?.enseignant?.prenom ?? '';
      const joursEcoules = Math.floor(
        (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );

      if (!enseignantEmail) continue;

      try {
        await this.email.sendGenericNotification(
          enseignantEmail,
          `Rappel — Devis en attente de réponse pour « ${sejourTitre} »`,
          `<p>Bonjour ${enseignantPrenom},</p>
           <p>Le devis de <strong>${centreNom}</strong> pour votre séjour <strong>« ${sejourTitre} »</strong> est en attente de votre réponse depuis <strong>${joursEcoules} jours</strong>.</p>
           <p>Connectez-vous à LIAVO pour consulter le devis et prendre une décision.</p>`,
        );

        await this.prisma.devis.update({
          where: { id: d.id },
          data: { relanceEnvoyeeAt: new Date() },
        });

        this.logger.log(`[CRON] Relance envoyée — devis: ${d.id}`);
      } catch (err) {
        this.logger.error(`[CRON] Échec relance devis ${d.id}`, err);
      }
    }
  }

  @Cron('0 9 * * *', { timeZone: 'Europe/Paris' })
  async relancerHerbergeurDevisIgnore() {
    this.logger.log('[CRON] Déclenchement relance-hebergeur-devis');

    const seuil = new Date();
    seuil.setDate(seuil.getDate() - DELAI_RELANCE_HEBERGEUR_JOURS);

    const devis = await this.prisma.devis.findMany({
      where: {
        statut: 'EN_ATTENTE',
        createdAt: { lte: seuil },
      },
      include: {
        centre: {
          include: {
            user: { select: { email: true, prenom: true } },
          },
        },
        demande: {
          include: {
            sejour: { select: { titre: true, dateDebut: true } },
            enseignant: { select: { prenom: true, nom: true } },
          },
        },
      },
    });

    this.logger.log(`[CRON] ${devis.length} devis EN_ATTENTE sans réponse depuis 30j`);

    for (const d of devis) {
      const centreEmail = d.centre?.user?.email;
      const centrePrenom = d.centre?.user?.prenom ?? '';
      const centreNom = d.centre?.nom ?? 'votre centre';
      const sejourTitre = d.demande?.sejour?.titre ?? 'le séjour';
      const enseignantNom = d.demande?.enseignant
        ? `${d.demande.enseignant.prenom} ${d.demande.enseignant.nom}`
        : 'l\'enseignant';
      const joursEcoules = Math.floor(
        (Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24),
      );

      if (!centreEmail) continue;

      try {
        await this.email.sendGenericNotification(
          centreEmail,
          `Rappel — Votre devis pour « ${sejourTitre} » n'a pas encore reçu de réponse`,
          `<p>Bonjour ${centrePrenom},</p>
           <p>Votre devis pour le séjour <strong>« ${sejourTitre} »</strong> envoyé à ${enseignantNom} est en attente de réponse depuis <strong>${joursEcoules} jours</strong>.</p>
           <p>L'enseignant n'a pas encore donné suite. Vous pouvez le relancer directement ou consulter l'état de votre devis depuis votre tableau de bord.</p>
           <p style="margin:24px 0"><a href="${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/dashboard/venue/demandes" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Voir mes demandes</a></p>`,
        );

        this.logger.log(`[CRON] Relance hébergeur envoyée — devis: ${d.id}, centre: ${centreNom}`);
      } catch (err) {
        this.logger.error(`[CRON] Échec relance hébergeur devis ${d.id}`, err);
      }
    }
  }
}
