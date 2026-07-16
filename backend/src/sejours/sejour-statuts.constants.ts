import { StatutSejour } from '@prisma/client';

// Sets de statuts séjour partagés (§4.25, parallèle de devis-statuts.constants.ts).
// Une constante PAR INTENTION et PAR COMPOSITION — ne pas fondre deux
// compositions différentes. Recensement : docs/refacto-statuts-sejour-4.25.md.

/**
 * Séjours « confirmés » : convention signée et étapes ultérieures (rectorat,
 * signature direction, déclaration TAM). Base du remplissage/CA pilotage et du
 * planning confirmé du dashboard global.
 */
export const STATUTS_SEJOUR_CONFIRMES: StatutSejour[] = [
  StatutSejour.CONVENTION,
  StatutSejour.SOUMIS_RECTORAT,
  StatutSejour.SIGNE_DIRECTION,
  StatutSejour.DECLARE_TAM,
];

/**
 * Séjours accessibles en mode COLLABORATIF (espace de collaboration ouvert) :
 * convention établie ou signée direction.
 */
export const STATUTS_SEJOUR_COLLABORATIFS: StatutSejour[] = [
  StatutSejour.CONVENTION,
  StatutSejour.SIGNE_DIRECTION,
];

/**
 * Séjours accessibles à l'hébergeur en gestion DIRECTE : OPTION en plus des
 * statuts collaboratifs (dérivation par spread conservée de l'origine).
 */
export const STATUTS_SEJOUR_DIRECT: StatutSejour[] = [
  StatutSejour.OPTION,
  ...STATUTS_SEJOUR_COLLABORATIFS,
];
