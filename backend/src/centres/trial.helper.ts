/**
 * Retourne la date d'expiration du trial (now + 30 jours, minuit, date pure).
 * Utilisé à la création/validation du compte hébergeur.
 */
export function trialExpiration(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return new Date(d.toISOString().split('T')[0]);
}
