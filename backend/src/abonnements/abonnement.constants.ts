// Source unique des prix d'abonnement (CENTIMES) — consommée par
// AbonnementService (souscription + webhook Mollie) et CronAlertesService
// (email de renouvellement J-30). Extraite pour le fix 10.5 : le mail de
// renouvellement recalculait le montant depuis une map locale en euros,
// sans le supplément multi-centre.

export const PRIX_MENSUEL: Record<string, number> = {
  ESSENTIEL: 2900,
  COMPLET: 4900,
  PILOTAGE: 6900,
};
export const PRIX_ANNUEL: Record<string, number> = {
  ESSENTIEL: 29000,
  COMPLET: 49000,
  PILOTAGE: 69000,
};
export const CENTRE_SUPP_MENSUEL = 3900;
export const CENTRE_SUPP_ANNUEL = 39000;

/**
 * Montant total d'un abonnement en centimes : prix du plan + supplément
 * par centre ACTIF au-delà du premier (39 €/mois ou 390 €/an par centre).
 * Plan inconnu → 0 (comportement du webhook Mollie, `?? 0`).
 */
export function calculerMontantAbonnementCents(
  plan: string,
  frequence: string,
  nbCentresActifs: number,
): number {
  const annuel = frequence === 'ANNUEL';
  const prixPlan = (annuel ? PRIX_ANNUEL : PRIX_MENSUEL)[plan] ?? 0;
  const centresSupp = Math.max(0, nbCentresActifs - 1);
  return prixPlan + centresSupp * (annuel ? CENTRE_SUPP_ANNUEL : CENTRE_SUPP_MENSUEL);
}
