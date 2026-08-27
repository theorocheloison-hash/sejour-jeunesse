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
// Supplément par centre ACTIF au-delà du premier, PAR PLAN (centimes).
// ESSENTIEL n'ouvre pas le multi-centre facturable (0). Annuel = ×10 mensuel.
export const CENTRE_SUPP_MENSUEL: Record<string, number> = { ESSENTIEL: 0, COMPLET: 2900, PILOTAGE: 4900 };
export const CENTRE_SUPP_ANNUEL: Record<string, number> = { ESSENTIEL: 0, COMPLET: 29000, PILOTAGE: 49000 };

/**
 * Conversion centimes → montant Mollie ("146.80"). Copie exportée de la
 * fonction privée d'abonnement.service.ts (duplication temporaire assumée,
 * résorbée au Lot 2a quand le service basculera sur cet export).
 */
export function centsToMollie(cents: number): string {
  return (cents / 100).toFixed(2);
}

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
  const suppUnitaire = (annuel ? CENTRE_SUPP_ANNUEL : CENTRE_SUPP_MENSUEL)[plan] ?? 0;
  return prixPlan + centresSupp * suppUnitaire;
}

/**
 * Montant d'une facturation LIAVO sur une PÉRIODE explicite de N mois (centimes) :
 * N × (prix mensuel du plan + supplément mensuel par centre actif au-delà du
 * premier). Base tarifaire mensuelle uniquement (une période se compte en mois).
 * Source unique consommée par la facture-période ET le devis-période — garantit
 * que les deux pièces portent le même montant. Plan inconnu → 0 (le contrôle de
 * validité du plan reste à la charge de l'appelant).
 */
export function calculerMontantPeriodeCents(
  plan: string,
  nbMois: number,
  nbCentresActifs: number,
): number {
  const prixPlan = PRIX_MENSUEL[plan] ?? 0;
  const centresSupp = Math.max(0, nbCentresActifs - 1);
  const suppUnitaire = CENTRE_SUPP_MENSUEL[plan] ?? 0;
  return nbMois * (prixPlan + centresSupp * suppUnitaire);
}

/**
 * Libellé d'une pièce LIAVO sur période explicite — source unique partagée par
 * facturerCentrePeriode (facture FL-) et genererDevisLiavoPeriode (devis DL-)
 * pour que les deux pièces portent le même intitulé. Dates rendues en UTC : les
 * ISO date-only sont parsées à minuit UTC, un rendu local afficherait la veille.
 */
export function libellePeriodeAbonnement(
  plan: string,
  periodeDebut: Date,
  periodeFin: Date,
  nbMois: number,
): string {
  const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { timeZone: 'UTC' });
  return `Abonnement LIAVO ${plan} — période du ${fmt(periodeDebut)} au ${fmt(periodeFin)} (${nbMois} mois)`;
}

// Hiérarchie des plans — source unique consommée par PlanGuard,
// rooming.assertPlanCentreComplet et demande.findOpen (fin de la triple copie, L3a).
export const PLAN_HIERARCHY: Record<string, number> = {
  DECOUVERTE: 0,
  ESSENTIEL: 1,
  COMPLET: 2,
  PILOTAGE: 3,
};

/**
 * Plan effectif d'un porteur d'abonnement (organisation depuis L3a, centre avant) :
 * DECOUVERTE si l'abo est inactif/expiré, sinon le plan (DECOUVERTE si plan absent).
 * Fonction PURE : reçoit les 3 champs d'abo, ne connaît PAS le cas « org null »
 * (le fallback org-null se décide dans chaque consommateur avant l'appel).
 */
export function getPlanEffectif(
  statut: string | null,
  exp: Date | string | null,
  plan: string | null,
): string {
  const isActive = statut === 'ACTIF' && !!exp && new Date(exp) >= new Date();
  return isActive ? (plan ?? 'DECOUVERTE') : 'DECOUVERTE';
}
