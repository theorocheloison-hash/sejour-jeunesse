// Durée de vie glissante du lien public de signature : repoussée à chaque
// transmission (envoi email, marquer-envoye, relance cron portant le lien).
// Un devis signé reste consultable sans limite ; NULL = lien legacy non armé.
export const DUREE_LIEN_SIGNATURE_JOURS = 30;

export function prochaineLienSignatureExpiration(): Date {
  return new Date(Date.now() + DUREE_LIEN_SIGNATURE_JOURS * 86400000);
}
