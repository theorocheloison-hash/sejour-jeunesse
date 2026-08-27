import type { PrismaService } from '../prisma/prisma.service.js';
import { calculerMontantAbonnementCents } from './abonnement.constants.js';

/**
 * Montant récurrent (centimes) d'une organisation abonnée : prix du plan +
 * supplément par centre EXPLOITÉ (statut ACTIVE, userId non null — les fiches
 * catalogue APIDAE/LMDJ jamais revendiquées sont exclues) au-delà du premier,
 * à la fréquence portée par l'org (mensuel/annuel).
 *
 * POINT DE CALCUL UNIQUE des montants dérivés de l'ORGANISATION : resync Mollie,
 * fallback du webhook, mail de renouvellement. Les chemins où le plan ET la
 * fréquence sont choisis par l'APPELANT (souscription, facturation admin sur
 * période) NE passent PAS ici — sémantique différente.
 *
 * >>> C'est LE point d'injection du futur PRIX NÉGOCIÉ par organisation : le
 *     jour venu, `return org.prixNegocieCents ?? <formule>`. Ne PAS ajouter le
 *     champ maintenant — le seam suffit.
 *
 * Helper PUR (patron resync/trial.helper) : prisma reçu en paramètre, aucune
 * dépendance de module NestJS, aucun cycle possible. Org absente ou plan
 * inconnu/DECOUVERTE → 0 (le garde « montant nul » reste à la charge de
 * l'appelant, comportement du webhook Mollie `?? 0`).
 */
export async function montantRecurrentOrganisationCents(
  prisma: PrismaService,
  organisationId: string,
): Promise<number> {
  const org = await prisma.organisation.findUnique({
    where: { id: organisationId },
    select: { planAbonnement: true, abonnement: true },
  });
  if (!org) return 0;

  const nbCentresExploites = await prisma.centreHebergement.count({
    where: { organisationId, statut: 'ACTIVE', userId: { not: null } },
  });

  return calculerMontantAbonnementCents(
    org.planAbonnement,
    org.abonnement ?? 'MENSUEL',
    nbCentresExploites,
  );
}
