import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';

// Échappe le HTML d'un message libre avant injection dans un email (anti-XSS)
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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
          `Rappel demain — ${escapeHtml(rappel.type)} : ${escapeHtml(rappel.client.nom)}`,
          `<p>Bonjour,</p>
           <p>Vous avez un rappel prévu <strong>demain ${dateFormatee}</strong> pour le client <strong>${escapeHtml(rappel.client.nom)}</strong> :</p>
           <table style="width:100%;border-collapse:collapse;margin:16px 0">
             <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Type</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${escapeHtml(rappel.type)}</td></tr>
             <tr><td style="padding:8px 12px;font-size:13px;color:#666">Description</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${escapeHtml(rappel.description)}</td></tr>
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
          `Rappel — Devis en attente de réponse pour « ${escapeHtml(sejourTitre)} »`,
          `<p>Bonjour ${escapeHtml(enseignantPrenom)},</p>
           <p>Le devis de <strong>${escapeHtml(centreNom)}</strong> pour votre séjour <strong>« ${escapeHtml(sejourTitre)} »</strong> est en attente de votre réponse depuis <strong>${joursEcoules} jours</strong>.</p>
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
    if (process.env.ENABLE_CRON !== 'true') return;

    this.logger.log('[CRON] Déclenchement relance-hebergeur-devis');

    const seuil = new Date();
    seuil.setDate(seuil.getDate() - DELAI_RELANCE_HEBERGEUR_JOURS);

    const devis = await this.prisma.devis.findMany({
      where: {
        statut: 'EN_ATTENTE',
        isComplementaire: false,
        // NULL (jamais envoyé) exclu automatiquement : NULL <= seuil vaut faux.
        dateEnvoi: { lte: seuil },
        // ⚠️ Deux OR au même niveau s'écrasent en JS — les combiner via AND.
        AND: [
          { OR: [{ relanceHebergeurAt: null }, { relanceHebergeurAt: { lte: seuil } }] },
          { OR: [{ sejourDirectId: null }, { sejourDirect: { deletedAt: null } }] },
        ],
      },
      include: {
        centre: {
          select: {
            id: true,
            nom: true,
            user: { select: { email: true, prenom: true } },
          },
        },
        sejourDirect: {
          select: { titre: true, clientNom: true, clientPrenom: true, clientOrganisation: true },
        },
        demande: {
          select: {
            sejour: { select: { titre: true } },
            enseignant: { select: { prenom: true, nom: true } },
          },
        },
      },
    });

    // Regrouper par centre (destinataire = user du centre).
    const parCentre = new Map<
      string,
      { email: string; prenom: string; centreNom: string; items: typeof devis }
    >();
    for (const d of devis) {
      const email = d.centre?.user?.email;
      if (!email) continue;
      const key = d.centre.id;
      const groupe = parCentre.get(key);
      if (groupe) {
        groupe.items.push(d);
      } else {
        parCentre.set(key, {
          email,
          prenom: d.centre.user?.prenom ?? '',
          centreNom: d.centre.nom,
          items: [d],
        });
      }
    }

    this.logger.log(`[CRON] ${parCentre.size} centre(s) à relancer (digest)`);

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';
    let envois = 0;

    for (const groupe of parCentre.values()) {
      const n = groupe.items.length;

      const lignes = groupe.items
        .map((d) => {
          const titre = d.sejourDirect?.titre ?? d.demande?.sejour?.titre ?? 'le séjour';
          const client =
            [d.sejourDirect?.clientPrenom, d.sejourDirect?.clientNom].filter(Boolean).join(' ') ||
            d.sejourDirect?.clientOrganisation ||
            (d.demande?.enseignant
              ? `${d.demande.enseignant.prenom} ${d.demande.enseignant.nom}`
              : '') ||
            'votre client';
          const base = d.dateEnvoi ?? d.createdAt;
          const jours = Math.floor((Date.now() - new Date(base).getTime()) / 86400000);
          const montant = Number(d.montantTTC ?? 0).toLocaleString('fr-FR', {
            minimumFractionDigits: 2,
          });
          return `<tr>
            <td style="padding:8px 12px;font-size:13px;font-weight:600">${escapeHtml(titre)}</td>
            <td style="padding:8px 12px;font-size:13px;color:#666">${escapeHtml(client)}</td>
            <td style="padding:8px 12px;font-size:13px;color:#666">${montant} €</td>
            <td style="padding:8px 12px;font-size:13px;color:#666">${jours} j</td>
          </tr>`;
        })
        .join('');

      const message =
        `Bonjour ${escapeHtml(groupe.prenom)},<br/><br/>` +
        `${n === 1 ? 'Un de vos devis est' : `${n} de vos devis sont`} en attente de réponse de ` +
        `${n === 1 ? 'votre client' : 'vos clients'} depuis plus de ${DELAI_RELANCE_HEBERGEUR_JOURS} jours :` +
        `<table style="width:100%;border-collapse:collapse;margin:16px 0">` +
        `<tr style="background:#f5f7fa">` +
        `<td style="padding:8px 12px;font-size:12px;color:#999">Séjour</td>` +
        `<td style="padding:8px 12px;font-size:12px;color:#999">Client</td>` +
        `<td style="padding:8px 12px;font-size:12px;color:#999">Montant</td>` +
        `<td style="padding:8px 12px;font-size:12px;color:#999">En attente</td>` +
        `</tr>${lignes}</table>` +
        `<p>Vous pouvez les relancer directement ou consulter leur état depuis votre tableau de bord.</p>` +
        `<p style="margin:24px 0"><a href="${frontendUrl}/dashboard/hebergeur/demandes" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Voir mes demandes</a></p>`;

      try {
        await this.email.sendGenericNotification(
          groupe.email,
          n === 1 ? 'Un devis en attente de réponse' : `${n} devis en attente de réponse`,
          message,
          undefined,
          undefined,
          null,
        );
        // Tampon posé sur TOUT le lot, APRÈS envoi réussi (échec = réessai demain).
        await this.prisma.devis.updateMany({
          where: { id: { in: groupe.items.map((d) => d.id) } },
          data: { relanceHebergeurAt: new Date() },
        });
        envois++;
        this.logger.log(`[CRON] Digest relance hébergeur envoyé — centre: ${groupe.centreNom}, ${n} devis`);
      } catch (err) {
        this.logger.error(`[CRON] Échec digest relance hébergeur — centre: ${groupe.centreNom}`, err);
      }
    }

    this.logger.log(`[CRON] ${envois} digest(s) relance hébergeur envoyé(s)`);
  }
}
