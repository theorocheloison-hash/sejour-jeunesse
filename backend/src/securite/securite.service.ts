import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { escapeHtml } from '../utils/escape-html.js';

/**
 * Alertes maison — journal de sécurité + règles d'alerte.
 *
 * Principe : PRÉVENIR, JAMAIS BLOQUER (décision Théo 26/09/2026) — un blocage
 * automatique de compte offrirait à un tiers le moyen de verrouiller un
 * hébergeur en plein départ de séjour. Les seuls freins restent les limites
 * par IP existantes (ThrottlerGuard).
 *
 * Aucune méthode publique ne lève : une panne du journal ou de l'email ne doit
 * jamais faire échouer une connexion ni une consultation.
 */

export type TypeEvenementSecurite =
  | 'CONNEXION_ECHEC'
  | 'CONNEXION_OK'
  | 'CONNEXION_LIEN_MAGIQUE'
  | 'BLOCAGE_LIMITE'        // limite anti-abus déclenchée hors routes d'authentification
  | 'BLOCAGE_LIMITE_AUTH'   // limite anti-abus déclenchée sur /auth/*
  | 'MDP_REINITIALISE'
  | 'MDP_MODIFIE'
  | 'ROLE_MODIFIE'
  | 'ACCES_MASSIF'
  | 'ALERTE_ENVOYEE';

export interface ContexteRequete {
  ip?: string | null;
  userAgent?: string | null;
}

export const JOURS_CONSERVATION_JOURNAL_SECURITE = 365;

/** Seuils (arbitrés 26/09/2026 — cf. LIAVO_SESSION_STATE). */
export const SEUILS_SECURITE = {
  echecsEmail15min: 10,
  echecsEmail24h: 20,
  blocagesAuthIp1h: 3,
  sejoursDistincts1h: 30,
  documentsMedicaux1h: 200,
  /** Une même alerte (même clé) n'est envoyée qu'une fois par heure. */
  delaiRepetitionAlerteMs: 3600000,
} as const;

const MIN = 60000;
const HEURE = 3600000;
const JOUR = 86400000;
const DOSSIER_DOCUMENTS_MEDICAUX = 'documents-medicaux/';

@Injectable()
export class SecuriteService {
  private readonly logger = new Logger(SecuriteService.name);

  // Compteurs de consultation en mémoire (mono-conteneur) : une écriture en
  // base à chaque affichage de fiche serait disproportionnée. Un redémarrage
  // remet les fenêtres à zéro — acceptable pour une détection d'abus.
  private readonly sejoursConsultes = new Map<string, Map<string, number>>();
  private readonly documentsMedicauxOuverts = new Map<string, number[]>();
  // Anti-doublon des blocages : un blocage n'est journalisé qu'une fois par
  // période de blocage (le guard lève à chaque requête bloquée).
  private readonly blocagesEnCours = new Map<string, number>();

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
  ) {}

  // ── Connexions ─────────────────────────────────────────────────────

  async connexionEchouee(emailSaisi: string, ctx: ContexteRequete = {}, now = new Date()): Promise<void> {
    const email = normaliserEmail(emailSaisi);
    await this.journaliser('CONNEXION_ECHEC', { email, ...ctx }, now);
    await this.sansErreur('connexionEchouee', async () => {
      const [sur15min, sur24h] = await Promise.all([
        this.compter({ type: 'CONNEXION_ECHEC', email }, now, 15 * MIN),
        this.compter({ type: 'CONNEXION_ECHEC', email }, now, JOUR),
      ]);
      if (sur15min >= SEUILS_SECURITE.echecsEmail15min || sur24h >= SEUILS_SECURITE.echecsEmail24h) {
        await this.alerter(
          `echecs:${email}`,
          `Tentatives de connexion suspectes sur ${email}`,
          `<p>${sur15min} échec(s) de connexion en 15 minutes et ${sur24h} en 24 heures sur le compte <b>${escapeHtml(email)}</b>.</p>` +
            `<p>Dernière IP : ${escapeHtml(ctx.ip ?? 'inconnue')}</p>` +
            `<p>Aucun blocage automatique n'est appliqué. Si ce n'est pas l'utilisateur, prévenez-le et invitez-le à changer son mot de passe.</p>`,
          now,
        );
      }
    });
  }

  /** Connexion aboutie (mot de passe ou lien magique). Compte ADMIN depuis une IP
   *  jamais vue sur la période de conservation → alerte. */
  async connexionReussie(
    user: { id: string; email: string; role: string },
    ctx: ContexteRequete = {},
    viaLienMagique = false,
    now = new Date(),
  ): Promise<void> {
    await this.sansErreur('connexionReussie', async () => {
      if (user.role === 'ADMIN' && ctx.ip) {
        // Lu AVANT d'écrire l'événement courant, sinon l'IP serait toujours « connue ».
        const dejaVue = await this.prisma.evenementSecurite.count({
          where: {
            userId: user.id,
            ip: ctx.ip,
            type: { in: ['CONNEXION_OK', 'CONNEXION_LIEN_MAGIQUE'] },
            createdAt: { gte: new Date(now.getTime() - JOURS_CONSERVATION_JOURNAL_SECURITE * JOUR) },
          },
        });
        if (dejaVue === 0) {
          await this.alerter(
            `admin-ip:${user.id}:${ctx.ip}`,
            'Connexion au compte admin depuis une nouvelle adresse IP',
            `<p>Le compte admin <b>${escapeHtml(user.email)}</b> vient de se connecter depuis une IP inconnue : <b>${escapeHtml(ctx.ip)}</b>.</p>` +
              `<p>Navigateur : ${escapeHtml(ctx.userAgent ?? 'inconnu')}</p>` +
              `<p>Si ce n'est pas vous : changez immédiatement le mot de passe (« mot de passe oublié » déconnecte toutes les sessions).</p>`,
            now,
          );
        }
      }
    });
    await this.journaliser(viaLienMagique ? 'CONNEXION_LIEN_MAGIQUE' : 'CONNEXION_OK', {
      userId: user.id,
      email: normaliserEmail(user.email),
      ...ctx,
    }, now);
  }

  // ── Limites anti-abus (ThrottlerGuard) ─────────────────────────────

  async blocageLimite(route: string, ctx: ContexteRequete, dureeBlocageMs: number, now = new Date()): Promise<void> {
    const ip = ctx.ip ?? 'inconnue';
    const cle = `${ip}|${route}`;
    const finBlocage = this.blocagesEnCours.get(cle);
    if (finBlocage !== undefined && finBlocage > now.getTime()) return;
    this.blocagesEnCours.set(cle, now.getTime() + dureeBlocageMs);
    for (const [k, fin] of this.blocagesEnCours) if (fin <= now.getTime()) this.blocagesEnCours.delete(k);

    const surAuth = route.startsWith('/auth/');
    await this.journaliser(surAuth ? 'BLOCAGE_LIMITE_AUTH' : 'BLOCAGE_LIMITE', { ...ctx, details: { route } }, now);
    if (!surAuth || !ctx.ip) return;
    await this.sansErreur('blocageLimite', async () => {
      const blocages = await this.compter({ type: 'BLOCAGE_LIMITE_AUTH', ip: ctx.ip! }, now, HEURE);
      if (blocages >= SEUILS_SECURITE.blocagesAuthIp1h) {
        await this.alerter(
          `blocages:${ctx.ip}`,
          `Adresse IP bloquée à répétition sur la connexion (${ctx.ip})`,
          `<p>L'IP <b>${escapeHtml(ctx.ip)}</b> a été bloquée ${blocages} fois en 1 heure par les limites anti-abus des pages de connexion / mot de passe.</p>` +
            `<p>Dernière route : ${escapeHtml(route)}<br>Navigateur : ${escapeHtml(ctx.userAgent ?? 'inconnu')}</p>`,
          now,
        );
      }
    });
  }

  // ── Mots de passe & rôles ──────────────────────────────────────────

  /** Journalise ET prévient le titulaire du compte. */
  async motDePasseChange(
    user: { id: string; email: string; prenom?: string | null },
    mode: 'REINITIALISE' | 'MODIFIE',
    ctx: ContexteRequete = {},
    now = new Date(),
  ): Promise<void> {
    await this.journaliser(mode === 'REINITIALISE' ? 'MDP_REINITIALISE' : 'MDP_MODIFIE', {
      userId: user.id,
      email: normaliserEmail(user.email),
      ...ctx,
    }, now);
    await this.sansErreur('motDePasseChange', () =>
      this.email.sendGenericNotification(
        user.email,
        'Votre mot de passe LIAVO a été modifié',
        `Bonjour${user.prenom ? ' ' + escapeHtml(user.prenom) : ''},<br><br>` +
          `Le mot de passe de votre compte LIAVO a été modifié le ${formatDateParis(now)}.<br><br>` +
          `<b>Si c'est vous</b>, vous n'avez rien à faire.<br>` +
          `<b>Si ce n'est pas vous</b>, réinitialisez immédiatement votre mot de passe avec le bouton ci-dessous ` +
          `(cela déconnecte toutes les sessions) et écrivez-nous à contact@liavo.fr.`,
        undefined,
        undefined,
        { text: 'Réinitialiser mon mot de passe', url: `${process.env.FRONTEND_URL ?? 'https://liavo.fr'}/forgot-password` },
      ),
    );
  }

  async roleModifie(
    adminId: string,
    cible: { id: string; email: string },
    ancienRole: string,
    nouveauRole: string,
    now = new Date(),
  ): Promise<void> {
    await this.journaliser('ROLE_MODIFIE', {
      userId: cible.id,
      email: normaliserEmail(cible.email),
      details: { adminId, ancienRole, nouveauRole },
    }, now);
    await this.sansErreur('roleModifie', () =>
      this.alerter(
        `role:${cible.id}:${nouveauRole}:${now.getTime()}`,
        `Rôle modifié : ${cible.email} → ${nouveauRole}`,
        `<p>Le rôle du compte <b>${escapeHtml(cible.email)}</b> est passé de <b>${escapeHtml(ancienRole)}</b> à <b>${escapeHtml(nouveauRole)}</b> depuis l'espace admin.</p>` +
          `<p>Si ce n'est pas vous, votre compte admin est peut-être compromis.</p>`,
        now,
      ),
    );
  }

  // ── Consultations massives (compteurs mémoire) ─────────────────────

  consultationParticipants(userId: string, sejourId: string, now = new Date()): void {
    const t = now.getTime();
    const vus = this.sejoursConsultes.get(userId) ?? new Map<string, number>();
    vus.set(sejourId, t);
    for (const [id, ts] of vus) if (ts <= t - HEURE) vus.delete(id);
    this.sejoursConsultes.set(userId, vus);
    if (vus.size >= SEUILS_SECURITE.sejoursDistincts1h) {
      void this.accesMassif(userId, 'participants', vus.size, now);
    }
  }

  lienDocumentGenere(userId: string, url: string, now = new Date()): void {
    if (!estDocumentMedical(url)) return;
    const t = now.getTime();
    const liste = (this.documentsMedicauxOuverts.get(userId) ?? []).filter((ts) => ts > t - HEURE);
    liste.push(t);
    this.documentsMedicauxOuverts.set(userId, liste);
    if (liste.length >= SEUILS_SECURITE.documentsMedicaux1h) {
      void this.accesMassif(userId, 'documents-medicaux', liste.length, now);
    }
  }

  private async accesMassif(userId: string, nature: 'participants' | 'documents-medicaux', volume: number, now: Date) {
    await this.sansErreur('accesMassif', async () => {
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
      const email = user?.email ?? userId;
      const libelle = nature === 'participants'
        ? `a consulté la liste des inscrits de ${volume} séjours différents en 1 heure`
        : `a ouvert ${volume} documents médicaux en 1 heure`;
      const envoyee = await this.alerter(
        `massif:${nature}:${userId}`,
        `Consultation massive de données par ${email}`,
        `<p>Le compte <b>${escapeHtml(email)}</b> (${escapeHtml(user?.role ?? '?')}) ${libelle}.</p>` +
          `<p>Si ce volume ne correspond pas à un usage normal, le compte est peut-être utilisé par un tiers : suspendez-le depuis l'espace admin et contactez son titulaire.</p>`,
        now,
      );
      if (envoyee) {
        await this.journaliser('ACCES_MASSIF', { userId, email: user?.email, details: { nature, volume } }, now);
      }
    });
  }

  // ── Purge ──────────────────────────────────────────────────────────

  /** 4h Europe/Paris — même garde que les autres crons (ENABLE_CRON=true en prod uniquement). */
  @Cron('0 4 * * *', { timeZone: 'Europe/Paris' })
  async cronPurge() {
    if (process.env.ENABLE_CRON !== 'true') return;
    try {
      const { supprimes } = await this.purgerJournal();
      this.logger.log(`[purgeJournalSecurite] ${supprimes} événement(s) supprimé(s)`);
    } catch (err) {
      this.logger.error('[purgeJournalSecurite] échec', err as Error);
    }
  }

  async purgerJournal(now: Date = new Date()): Promise<{ supprimes: number }> {
    const { count } = await this.prisma.evenementSecurite.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - JOURS_CONSERVATION_JOURNAL_SECURITE * JOUR) } },
    });
    return { supprimes: count };
  }

  // ── Interne ────────────────────────────────────────────────────────

  /** Envoie l'alerte à l'admin (ADMIN_ALERT_EMAIL, défaut contact@liavo.fr) sauf
   *  si la même clé a déjà été envoyée dans l'heure. Retourne true si envoyée. */
  private async alerter(cle: string, sujet: string, corpsHtml: string, now: Date): Promise<boolean> {
    const deja = await this.prisma.evenementSecurite.count({
      where: {
        type: 'ALERTE_ENVOYEE',
        createdAt: { gte: new Date(now.getTime() - SEUILS_SECURITE.delaiRepetitionAlerteMs) },
        details: { path: ['cle'], equals: cle },
      },
    });
    if (deja > 0) return false;
    await this.journaliser('ALERTE_ENVOYEE', { details: { cle, sujet } }, now);
    this.logger.warn(`[alerteSecurite] ${sujet}`);
    await this.email.sendNotifAdmin(`[LIAVO sécurité] ${sujet}`, corpsHtml + `<p style="color:#888;font-size:12px">Détecté le ${formatDateParis(now)}.</p>`);
    return true;
  }

  private async journaliser(
    type: TypeEvenementSecurite,
    data: { userId?: string | null; email?: string | null; ip?: string | null; userAgent?: string | null; details?: Prisma.InputJsonValue },
    now: Date,
  ): Promise<void> {
    await this.sansErreur(`journaliser ${type}`, () =>
      this.prisma.evenementSecurite.create({
        data: {
          type,
          userId: data.userId ?? null,
          email: data.email ? data.email.slice(0, 255) : null,
          ip: data.ip ? data.ip.slice(0, 64) : null,
          userAgent: data.userAgent ? data.userAgent.slice(0, 300) : null,
          ...(data.details !== undefined ? { details: data.details } : {}),
          createdAt: now,
        },
      }),
    );
  }

  private compter(filtre: { type: TypeEvenementSecurite; email?: string; ip?: string }, now: Date, fenetreMs: number) {
    return this.prisma.evenementSecurite.count({
      where: { ...filtre, createdAt: { gte: new Date(now.getTime() - fenetreMs) } },
    });
  }

  private async sansErreur(contexte: string, fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(`[securite] ${contexte} — échec ignoré`, err as Error);
    }
  }
}

export function normaliserEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function estDocumentMedical(url: string): boolean {
  try {
    const chemin = decodeURIComponent(new URL(url).pathname);
    return chemin.includes(`/${DOSSIER_DOCUMENTS_MEDICAUX}`);
  } catch {
    return url.includes(`/${DOSSIER_DOCUMENTS_MEDICAUX}`);
  }
}

function formatDateParis(d: Date): string {
  return d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
}
