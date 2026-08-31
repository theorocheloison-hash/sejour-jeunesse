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

const DELAI_RELANCE_DEVIS_JOURS = 30;   // 1re relance client à J+30
const INTERVALLE_RELANCE_JOURS = 30;    // puis mensuelle
const SEUIL_ESCALADE_JOURS = 180;       // 6 mois : stop client, escalade hébergeur
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
    if (process.env.ENABLE_CRON !== 'true') return;

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
    if (process.env.ENABLE_CRON !== 'true') return;

    this.logger.log('[CRON] Déclenchement relance-devis');

    const now = Date.now();
    const seuilPremiereRelance = new Date(now - DELAI_RELANCE_DEVIS_JOURS * 86400000);
    const seuilIntervalle = new Date(now - INTERVALLE_RELANCE_JOURS * 86400000);
    const seuilEscalade = new Date(now - SEUIL_ESCALADE_JOURS * 86400000);

    const devis = await this.prisma.devis.findMany({
      where: {
        statut: 'EN_ATTENTE',
        isComplementaire: false,
        // NULL (jamais envoyé) exclu : NULL <= seuil vaut faux.
        dateEnvoi: { lte: seuilPremiereRelance },
        OR: [
          { sejourDirectId: null },
          { sejourDirect: { deletedAt: null } },
        ],
      },
      include: {
        centre: {
          select: { id: true, nom: true, email: true, user: { select: { email: true } } },
        },
        sejourDirect: {
          select: { titre: true, clientNom: true, clientPrenom: true, clientEmail: true },
        },
        demande: {
          select: {
            sejour: { select: { titre: true } },
            enseignant: { select: { prenom: true, nom: true, email: true } },
          },
        },
      },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://liavo.fr';

    // Escalade hébergeur regroupée par centre (digest, 1 mail/centre).
    const escaladeParCentre = new Map<
      string,
      { hebergeurEmail: string; centreNom: string; items: typeof devis }
    >();

    let relancesClient = 0;

    for (const d of devis) {
      const envoye = d.dateEnvoi ? new Date(d.dateEnvoi).getTime() : 0;

      // ── ESCALADE (≥ 6 mois) : stop relance client, 1 escalade hébergeur ──
      if (envoye <= seuilEscalade.getTime()) {
        if (d.escaladeHebergeurAt != null) continue; // déjà escaladé
        const hebergeurEmail = d.centre?.user?.email;
        if (!hebergeurEmail) continue;
        const g = escaladeParCentre.get(d.centre.id);
        if (g) g.items.push(d);
        else escaladeParCentre.set(d.centre.id, { hebergeurEmail, centreNom: d.centre.nom, items: [d] });
        continue;
      }

      // ── RELANCE CLIENT (30 j → 6 mois), cadence mensuelle ──
      const derniere = d.relanceEnvoyeeAt ? new Date(d.relanceEnvoyeeAt) : null;
      if (derniere && derniere > seuilIntervalle) continue; // relancé il y a < 30 j

      const clientEmail = d.sejourDirect?.clientEmail ?? d.demande?.enseignant?.email ?? null;
      if (!clientEmail) continue;

      const prenom = d.sejourDirect
        ? (d.sejourDirect.clientPrenom ?? '')
        : (d.demande?.enseignant?.prenom ?? '');
      const titre = d.sejourDirect?.titre ?? d.demande?.sejour?.titre ?? 'votre séjour';
      const centreNom = d.centre?.nom ?? "l'hébergeur";
      const replyTo = d.centre?.email ? { name: d.centre.nom, email: d.centre.email } : undefined;
      const lienAction = d.sejourDirectId
        ? `${frontendUrl}/devis/signer/${d.tokenSignature}`
        : `${frontendUrl}/login`;
      const inviteReponse = replyTo
        ? `Et si votre projet a changé ou que vous ne comptez pas venir, répondez simplement à cet email pour en informer ${escapeHtml(centreNom)} — cela nous aide à tenir les disponibilités à jour.`
        : `Et si votre projet a changé, n'hésitez pas à en informer directement ${escapeHtml(centreNom)}.`;

      try {
        await this.email.sendGenericNotification(
          clientEmail,
          `Votre devis pour « ${escapeHtml(titre)} » vous attend`,
          `<p>Bonjour ${escapeHtml(prenom)},</p>
           <p>Il y a quelque temps, <strong>${escapeHtml(centreNom)}</strong> vous a transmis un devis pour <strong>« ${escapeHtml(titre)} »</strong>. Nous voulions prendre de vos nouvelles à ce sujet.</p>
           <p>Pour confirmer, vous pouvez consulter et signer le devis ci-dessous. ${inviteReponse}</p>
           <p style="margin:24px 0"><a href="${lienAction}" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Voir le devis</a></p>`,
          d.centre?.nom,
          replyTo,
          null,
        );
        await this.prisma.devis.update({
          where: { id: d.id },
          data: { relanceEnvoyeeAt: new Date() },
        });
        relancesClient++;
      } catch (err) {
        this.logger.error(`[CRON] Échec relance client devis ${d.id}`, err);
      }
    }

    this.logger.log(`[CRON] ${relancesClient} relance(s) client envoyée(s)`);

    // ── Digests d'escalade hébergeur ──
    let escalades = 0;
    for (const g of escaladeParCentre.values()) {
      const n = g.items.length;
      const lignes = g.items
        .map((d) => {
          const titre = d.sejourDirect?.titre ?? d.demande?.sejour?.titre ?? 'le séjour';
          const client =
            [d.sejourDirect?.clientPrenom, d.sejourDirect?.clientNom].filter(Boolean).join(' ') ||
            (d.demande?.enseignant ? `${d.demande.enseignant.prenom} ${d.demande.enseignant.nom}` : '') ||
            'client';
          const mois = Math.floor((now - new Date(d.dateEnvoi!).getTime()) / (30 * 86400000));
          return `<tr>
            <td style="padding:8px 12px;font-size:13px;font-weight:600">${escapeHtml(titre)}</td>
            <td style="padding:8px 12px;font-size:13px;color:#666">${escapeHtml(client)}</td>
            <td style="padding:8px 12px;font-size:13px;color:#666">${mois} mois</td>
          </tr>`;
        })
        .join('');

      const message =
        `Bonjour,<br/><br/>` +
        `${n === 1 ? 'Un devis que vous avez envoyé est resté' : `${n} devis que vous avez envoyés sont restés`} sans réponse depuis plus de 6 mois. Les relances automatiques ${n === 1 ? 'auprès du client ont' : 'auprès des clients ont'} été arrêtées.` +
        `<p>Une action de votre part est recommandée : relancer directement ${n === 1 ? 'le client' : 'les clients'}, ou supprimer le devis s'il n'est plus d'actualité.</p>` +
        `<table style="width:100%;border-collapse:collapse;margin:16px 0">` +
        `<tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:12px;color:#999">Séjour</td><td style="padding:8px 12px;font-size:12px;color:#999">Client</td><td style="padding:8px 12px;font-size:12px;color:#999">En attente</td></tr>` +
        `${lignes}</table>` +
        `<p style="margin:24px 0"><a href="${frontendUrl}/dashboard/hebergeur/demandes" style="display:inline-block;background:#1B4060;color:#fff;padding:12px 28px;border-radius:6px;font-weight:600;text-decoration:none;font-size:14px">Voir mes demandes</a></p>`;

      try {
        await this.email.sendGenericNotification(
          g.hebergeurEmail,
          n === 1 ? 'Un devis sans réponse depuis 6 mois — action requise' : `${n} devis sans réponse depuis 6 mois — action requise`,
          message,
          undefined,
          undefined,
          null,
        );
        await this.prisma.devis.updateMany({
          where: { id: { in: g.items.map((d) => d.id) } },
          data: { escaladeHebergeurAt: new Date() },
        });
        escalades++;
      } catch (err) {
        this.logger.error(`[CRON] Échec escalade hébergeur — centre: ${g.centreNom}`, err);
      }
    }

    this.logger.log(`[CRON] ${escalades} digest(s) d'escalade hébergeur envoyé(s)`);
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
