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
  organisationId: string,
): Promise<void> {
  try {
    const now = new Date();

    // L'essai est porté par l'ORGANISATION (Lot 2e — « une organisation = un
    // essai », remplace « un compte = un essai » du 14/07). Les centres sont
    // écrits en MIROIR (double écriture transitoire jusqu'à L3).
    const org = await prisma.organisation.findUnique({
      where: { id: organisationId },
      select: {
        mollieMandatId: true,
        modePaiement: true,
        abonnementStatut: true,
        trialStartedAt: true,
        abonnementActifJusquAu: true,
      },
    });
    if (!org) return;

    // a) Organisation payante : mandat Mollie ou virement → pas d'essai.
    if (org.mollieMandatId !== null || org.modePaiement === 'VIREMENT') return;

    // b) Abonnement offert / posé à la main (ex. Sauvageon) : ACTIF sans trial ni mandat.
    if (
      org.abonnementStatut === StatutAbonnement.ACTIF &&
      org.trialStartedAt === null &&
      org.mollieMandatId === null
    ) return;

    // c) Essai déjà présent sur l'org.
    if (org.trialStartedAt !== null) {
      // c-expiré : jamais de 2e essai. NO-OP strict (pas de findMany, pas d'update).
      if (!org.abonnementActifJusquAu || org.abonnementActifJusquAu <= now) return;
    }

    // Centres à miroiter/notifier : ACTIVE exploités (userId non null) encore
    // vierges d'essai. La garde trialStartedAt:null ne réécrit jamais un
    // timestamp historique (cas YAKA, dérive de ms bénigne).
    const centresAMiroiter = await prisma.centreHebergement.findMany({
      where: { organisationId, statut: 'ACTIVE', userId: { not: null }, trialStartedAt: null },
      select: { id: true, nom: true, userId: true },
    });

    let expiration: Date;
    let trialStartedAtValue: Date;
    let sujet: (nom: string) => string;
    let corps: (nom: string) => string;

    if (org.trialStartedAt !== null) {
      // c-en-cours : alignement sur la MÊME expiration (pas de prolongation),
      // AUCUN write sur l'org (l'essai y est déjà posé) — miroir seul.
      expiration = org.abonnementActifJusquAu!;
      trialStartedAtValue = org.trialStartedAt;
      sujet = (nom) => `[Admin] Centre ajouté à l'essai en cours — ${nom}`;
      corps = (nom) => `<p><strong>${nom}</strong> a été ajouté à l'essai gratuit en cours (Pilotage).</p>`;
    } else {
      // d) Organisation vierge : nouvel essai 30j Pilotage.
      // INVARIANT : aucun centre ACTIVE exploité éligible → aucun essai (un
      // PENDING ne consomme jamais l'essai, porté au niveau org).
      if (centresAMiroiter.length === 0) return;
      expiration = trialExpiration();
      trialStartedAtValue = now;
      await prisma.organisation.update({
        where: { id: organisationId },
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

    // c-en-cours sans nouveau centre à aligner : rien à miroiter ni notifier.
    if (centresAMiroiter.length === 0) return;

    // Miroir centres (double écriture transitoire jusqu'à L3).
    await prisma.centreHebergement.updateMany({
      where: { organisationId, statut: 'ACTIVE', userId: { not: null }, trialStartedAt: null },
      data: {
        planAbonnement: PlanAbonnement.PILOTAGE,
        abonnementStatut: StatutAbonnement.ACTIF,
        trialStartedAt: trialStartedAtValue,
        abonnementActifJusquAu: expiration,
      },
    });

    // Notifs admin sur les centres capturés AVANT l'update (jamais de findMany
    // post-update sur trialStartedAt : la comparaison de Date exacte est fragile).
    const dateExp = expiration.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const userCache = new Map<string, { prenom: string | null; nom: string | null; email: string } | null>();
    for (const centre of centresAMiroiter) {
      if (centre.userId && !userCache.has(centre.userId)) {
        userCache.set(
          centre.userId,
          await prisma.user.findUnique({
            where: { id: centre.userId },
            select: { email: true, prenom: true, nom: true },
          }),
        );
      }
      const user = centre.userId ? userCache.get(centre.userId) : null;
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
