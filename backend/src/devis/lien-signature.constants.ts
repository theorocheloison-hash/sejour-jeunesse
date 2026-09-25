// Durée de vie glissante du lien public de signature : repoussée à chaque
// transmission (envoi email, marquer-envoye, relance cron portant le lien).
// Un devis signé reste consultable sans limite ; NULL = lien legacy non armé.
export const DUREE_LIEN_SIGNATURE_JOURS = 30;

export function prochaineLienSignatureExpiration(): Date {
  return new Date(Date.now() + DUREE_LIEN_SIGNATURE_JOURS * 86400000);
}

// S1 : un devis NAÎT avec un lien éteint (expiration = maintenant). Seuls les
// envois autorisés l'arment ensuite : envoyerDevis / marquer-envoye /
// prolonger-lien (gatés assertEnvoiExterneAutorise), régénération et relance
// cron d'un centre VALIDÉ (estCentreValide).
export function lienSignatureEteint(): Date {
  return new Date();
}
