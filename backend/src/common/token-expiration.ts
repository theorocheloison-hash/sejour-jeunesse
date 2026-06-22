import { NotFoundException } from '@nestjs/common';

/**
 * Calcule la date d'expiration d'un token d'accès lié à un séjour.
 * Règle : dateFin + 30j si dateFin existe, sinon createdAt + 1 an.
 */
export function computeTokenExpiresAt(dateFin: Date | null): Date {
  if (dateFin) {
    return new Date(dateFin.getTime() + 30 * 24 * 60 * 60 * 1000);
  }
  // Séjour sans date fixe : 1 an à partir de maintenant
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
}

/**
 * Lève une 404 si le token est expiré. On répond « introuvable » (et non « expiré »)
 * pour ne pas leaker d'information sur l'existence du token.
 */
export function assertTokenNotExpired(expiresAt: Date | null, entityName: string): void {
  if (expiresAt && expiresAt < new Date()) {
    throw new NotFoundException(`${entityName} introuvable`);
  }
}
