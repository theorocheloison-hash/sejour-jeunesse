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
 * Source UNIQUE de démarrage de l'essai gratuit 30j Pilotage.
 * Appelée par les 4 chemins d'activation : login (auth.service), validation de
 * claim (claim.service), activation de centre et validation d'hébergeur
 * (admin.service).
 *
 * L'essai est porté par l'ORGANISATION seule (« une organisation = un essai ») ;
 * les colonnes abo des centres ne sont JAMAIS écrites (L3c) — un centre hérite
 * de l'essai par lecture org (L3a).
 *
 * Règles :
 * - a) organisation payante (mandat Mollie ou modePaiement VIREMENT) → aucun essai ;
 * - b) abonnement offert / posé à la main (ACTIF sans trial ni mandat, ex.
 *   Sauvageon) → aucun essai ;
 * - c) essai déjà consommé (en cours ou expiré) → no-op strict, jamais de 2e essai ;
 * - d) organisation vierge AVEC au moins un centre ACTIVE exploité → nouvel essai
 *   30j Pilotage sur l'org + notif admin « Nouveau trial » (un PENDING ne
 *   consomme jamais l'essai).
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
    // essai », remplace « un compte = un essai » du 14/07).
    const org = await prisma.organisation.findUnique({
      where: { id: organisationId },
      select: {
        mollieMandatId: true,
        modePaiement: true,
        abonnementStatut: true,
        trialStartedAt: true,
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

    // c) Essai déjà consommé (en cours ou expiré) → no-op strict. Un centre
    // rejoignant une org en essai hérite de l'essai PAR LECTURE org (L3a) ;
    // plus d'alignement miroir ni de notif « Centre ajouté » (décision 13/08,
    // anti-spam admin : sans le tampon trialStartedAt centre, la notif
    // repartait à chaque login).
    if (org.trialStartedAt !== null) return;

    // d) Organisation vierge : nouvel essai 30j Pilotage.
    // Centres ACTIVE exploités (userId non null) : sert l'invariant PENDING +
    // les destinataires de la notif « Nouveau trial ».
    const centresExploites = await prisma.centreHebergement.findMany({
      where: { organisationId, statut: 'ACTIVE', userId: { not: null } },
      select: { id: true, nom: true, userId: true },
    });

    // INVARIANT : aucun centre ACTIVE exploité → aucun essai (un PENDING ne
    // consomme jamais l'essai, porté au niveau org).
    if (centresExploites.length === 0) return;

    const expiration = trialExpiration();
    await prisma.organisation.update({
      where: { id: organisationId },
      data: {
        planAbonnement: PlanAbonnement.PILOTAGE,
        abonnementStatut: StatutAbonnement.ACTIF,
        trialStartedAt: now,
        abonnementActifJusquAu: expiration,
      },
    });

    // Notifs admin — une par centre exploité.
    const dateExp = expiration.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const userCache = new Map<string, { prenom: string | null; nom: string | null; email: string } | null>();
    for (const centre of centresExploites) {
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
          `[Admin] Nouveau trial — ${centre.nom}`,
          `<p><strong>${centre.nom}</strong> a activé un essai gratuit (30 jours Pilotage).</p>
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
