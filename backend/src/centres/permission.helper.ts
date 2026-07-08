import { PrismaService } from '../prisma/prisma.service.js';

export type PermissionLevel = 'NONE' | 'READ' | 'WRITE';
export type PermissionModule = 'planning' | 'sejours' | 'devis' | 'crm' | 'facturation' | 'parametres';

export interface CentrePermissions {
  isOwner: boolean;
  planning: PermissionLevel;
  sejours: PermissionLevel;
  devis: PermissionLevel;
  crm: PermissionLevel;
  facturation: PermissionLevel;
  parametres: PermissionLevel;
}

export const OWNER_PERMISSIONS: CentrePermissions = {
  isOwner: true,
  planning: 'WRITE', sejours: 'WRITE', devis: 'WRITE',
  crm: 'WRITE', facturation: 'WRITE', parametres: 'WRITE',
};

/**
 * Permissions d'un user sur un centre.
 * - Propriétaire → accès complet (OWNER_PERMISSIONS).
 * - Collaborateur accepté → permissions stockées sur CollaborateurCentre.
 * - Sinon → null (aucun accès).
 */
export async function getUserCentrePermissions(
  prisma: PrismaService,
  userId: string,
  centreId: string,
): Promise<CentrePermissions | null> {
  // 1. Propriétaire → full access
  const centre = await prisma.centreHebergement.findUnique({ where: { id: centreId } });
  // SUSPENDED = kill switch ; PENDING opérable (aligné sur getCentreForUser) —
  // les envois externes restent gatés séparément par assertEnvoiExterneAutorise.
  if (!centre || centre.statut === 'SUSPENDED') return null;
  if (centre.userId === userId) return OWNER_PERMISSIONS;

  // 2. Collaborateur → permissions from CollaborateurCentre
  const collab = await prisma.collaborateurCentre.findFirst({
    where: { centreId, userId, acceptedAt: { not: null } },
  });
  if (!collab) return null;

  const p = (collab.permissions ?? {}) as Record<string, string>;
  return {
    isOwner: false,
    planning: (p.planning as PermissionLevel) ?? 'NONE',
    sejours: (p.sejours as PermissionLevel) ?? 'NONE',
    devis: (p.devis as PermissionLevel) ?? 'NONE',
    crm: (p.crm as PermissionLevel) ?? 'NONE',
    facturation: (p.facturation as PermissionLevel) ?? 'NONE',
    parametres: (p.parametres as PermissionLevel) ?? 'NONE',
  };
}

export function hasPermission(
  perms: CentrePermissions,
  module: PermissionModule,
  requiredLevel: 'READ' | 'WRITE',
): boolean {
  if (perms.isOwner) return true;
  const level = perms[module];
  if (requiredLevel === 'READ') return level === 'READ' || level === 'WRITE';
  return level === 'WRITE';
}
