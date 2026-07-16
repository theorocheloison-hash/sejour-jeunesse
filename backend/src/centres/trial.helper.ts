import { PlanAbonnement, StatutAbonnement } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service.js';

/** Durée de l'essai gratuit Pilotage, en jours (§4.13 — source unique du 30). */
export const TRIAL_DUREE_JOURS = 30;

/**
 * Retourne la date d'expiration du trial (now + 30 jours, minuit, date pure).
 * Utilisé à la création/validation du compte hébergeur.
 */
export function trialExpiration(): Date {
  const d = new Date();
  d.setDate(d.getDate() + TRIAL_DUREE_JOURS);
  return new Date(d.toISOString().split('T')[0]);
}

/**
 * Source UNIQUE de démarrage (ou d'alignement) de l'essai gratuit 30j Pilotage.
 * Appelée par les 4 chemins d'activation : login (auth.service), validation de
 * claim (claim.service), activation de centre et validation d'hébergeur
 * (admin.service).
 *
 * Règles :
 * - seuls les centres ACTIVE vierges (trialStartedAt null, pas de mandat Mollie,
 *   abonnement INACTIF) sont éligibles — un centre PENDING ne consomme jamais
 *   son essai pendant l'attente de validation ;
 * - compte payant (mandat Mollie ou modePaiement VIREMENT) ou abonnement offert
 *   (ACTIF sans trial ni mandat, ex. Sauvageon) → aucun essai ;
 * - essai déjà en cours sur un autre centre → alignement sur la MÊME expiration
 *   (jamais de prolongation) ; essai terminé → aucun nouvel essai.
 *
 * `email` typé structurellement : ce helper ne doit pas importer EmailService
 * (aucune dépendance de module, aucun cycle possible).
 * Non bloquant : un échec ne doit JAMAIS faire échouer un login, une validation
 * de claim ou une activation de centre.
 */
export async function demarrerOuAlignerTrial(
  prisma: PrismaService,
  email: { sendNotifAdmin: (sujet: string, html: string) => Promise<unknown> },
  userId: string,
): Promise<void> {
  try {
    const now = new Date();

    const centres = await prisma.centreHebergement.findMany({
      where: { userId },
      select: {
        id: true,
        nom: true,
        statut: true,
        trialStartedAt: true,
        abonnementStatut: true,
        abonnementActifJusquAu: true,
        mollieMandatId: true,
        modePaiement: true,
      },
    });

    // a) Compte payant : le nouveau centre est facturé, pas d'essai.
    if (centres.some((c) => c.mollieMandatId !== null || c.modePaiement === 'VIREMENT')) return;

    // b) Abonnement offert / posé à la main (ex. Sauvageon) : ACTIF sans trial ni mandat.
    if (
      centres.some(
        (c) =>
          c.abonnementStatut === StatutAbonnement.ACTIF &&
          c.trialStartedAt === null &&
          c.mollieMandatId === null,
      )
    ) return;

    // c) Centres éligibles : ACTIVE, vierges de tout essai et de tout abonnement.
    const eligibles = centres.filter(
      (c) =>
        c.statut === 'ACTIVE' &&
        c.trialStartedAt === null &&
        c.mollieMandatId === null &&
        c.abonnementStatut === StatutAbonnement.INACTIF,
    );
    if (eligibles.length === 0) return;

    // d) Référence d'essai : le trialStartedAt non null le plus récent.
    const trialRef = centres
      .filter((c) => c.trialStartedAt !== null)
      .sort((a, b) => b.trialStartedAt!.getTime() - a.trialStartedAt!.getTime())[0] ?? null;

    let expiration: Date;
    let sujet: (nom: string) => string;
    let corps: (nom: string) => string;

    if (trialRef) {
      // d2) Essai terminé : aucun nouvel essai, le centre reste hors abonnement.
      if (!trialRef.abonnementActifJusquAu || trialRef.abonnementActifJusquAu <= now) return;

      // d1) Essai en cours : alignement sur la MÊME expiration (pas de prolongation).
      expiration = trialRef.abonnementActifJusquAu;
      await prisma.centreHebergement.updateMany({
        where: { id: { in: eligibles.map((c) => c.id) }, trialStartedAt: null },
        data: {
          planAbonnement: PlanAbonnement.PILOTAGE,
          abonnementStatut: StatutAbonnement.ACTIF,
          trialStartedAt: trialRef.trialStartedAt,
          abonnementActifJusquAu: trialRef.abonnementActifJusquAu,
        },
      });
      sujet = (nom) => `[Admin] Centre ajouté à l'essai en cours — ${nom}`;
      corps = (nom) => `<p><strong>${nom}</strong> a été ajouté à l'essai gratuit en cours (Pilotage).</p>`;
    } else {
      // d3) Aucun essai antérieur : nouvel essai 30 jours Pilotage.
      expiration = trialExpiration();
      await prisma.centreHebergement.updateMany({
        where: { id: { in: eligibles.map((c) => c.id) }, trialStartedAt: null },
        data: {
          planAbonnement: PlanAbonnement.PILOTAGE,
          abonnementStatut: StatutAbonnement.ACTIF,
          trialStartedAt: now,
          abonnementActifJusquAu: expiration,
        },
      });
      sujet = (nom) => `[Admin] Nouveau trial — ${nom}`;
      corps = (nom) => `<p><strong>${nom}</strong> a activé un essai gratuit (30 jours Pilotage).</p>`;
    }

    // Notifs admin sur les éligibles capturés AVANT l'update (jamais de findMany
    // post-update sur trialStartedAt : la comparaison de Date exacte est fragile).
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, prenom: true, nom: true },
    });
    const dateExp = expiration.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    for (const centre of eligibles) {
      await email
        .sendNotifAdmin(
          sujet(centre.nom),
          `${corps(centre.nom)}
           <table style="width:100%;border-collapse:collapse;margin:16px 0">
             <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Centre</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${centre.nom}</td></tr>
             <tr><td style="padding:8px 12px;font-size:13px;color:#666">Hébergeur</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${user?.prenom ?? ''} ${user?.nom ?? ''} — ${user?.email ?? 'N/A'}</td></tr>
             <tr style="background:#f5f7fa"><td style="padding:8px 12px;font-size:13px;color:#666">Expiration</td><td style="padding:8px 12px;font-size:13px;font-weight:600">${dateExp}</td></tr>
           </table>`,
        )
        .catch((err) => console.error('[trial] échec notif admin', err));
    }
  } catch (err) {
    console.error('[trial] échec démarrage/alignement', err);
  }
}
