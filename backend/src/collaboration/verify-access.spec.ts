import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { CollaborationService } from './collaboration.service';

/**
 * Mock Prisma minimal : uniquement les délégués atteints par verifyAccess
 * (directement + via getUserCentrePermissions). Aucune base réelle.
 */
function mockPrisma() {
  return {
    sejour: { findUnique: jest.fn() },
    accompagnateurMission: { findFirst: jest.fn() },
    centreHebergement: { findUnique: jest.fn() },
    collaborateurCentre: { findFirst: jest.fn() },
  };
}
type PrismaMock = ReturnType<typeof mockPrisma>;

describe('CollaborationService.verifyAccess — accès collaborateur d\'équipe (CollaborateurCentre)', () => {
  let prisma: PrismaMock;
  let service: CollaborationService;

  const OWNER = 'user-owner';
  const CREATEUR = 'user-createur';
  const COLLAB = 'user-collab';
  const TIERS = 'user-tiers';
  const CENTRE = 'centre-1';
  const SEJOUR = 'sejour-1';

  // Statut CONVENTION : présent dans STATUTS_SEJOUR_DIRECT ET _COLLABORATIFS →
  // la vérification de statut passe quelle que soit la branche, chaque test
  // atteint donc bien la garde d'accès finale.
  const sejour = {
    id: SEJOUR,
    deletedAt: null,
    statut: 'CONVENTION',
    createurId: CREATEUR,
    hebergementSelectionneId: CENTRE,
    hebergementSelectionne: { userId: OWNER },
  };

  // Arme le centre + la ligne collaborateur résolus par getUserCentrePermissions
  // (centre ACTIVE appartenant à OWNER ; permissions = null → pas collaborateur).
  const armerCollaborateur = (permissions: Record<string, string> | null) => {
    prisma.centreHebergement.findUnique.mockResolvedValue({
      id: CENTRE, nom: 'C', statut: 'ACTIVE', userId: OWNER,
    });
    prisma.collaborateurCentre.findFirst.mockResolvedValue(permissions ? { permissions } : null);
  };

  beforeEach(() => {
    prisma = mockPrisma();
    prisma.sejour.findUnique.mockResolvedValue(sejour);
    prisma.accompagnateurMission.findFirst.mockResolvedValue(null);
    service = new CollaborationService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
    );
  });

  it('propriétaire du centre → lecture ET écriture, sans résolution de permissions', async () => {
    await expect(service.verifyAccess(SEJOUR, OWNER, 'HEBERGEUR')).resolves.toMatchObject({ id: SEJOUR });
    await expect(service.verifyAccess(SEJOUR, OWNER, 'HEBERGEUR', 'WRITE')).resolves.toMatchObject({ id: SEJOUR });
    // isHebergeur court-circuite getUserCentrePermissions : aucune requête centre.
    expect(prisma.centreHebergement.findUnique).not.toHaveBeenCalled();
  });

  it('organisateur créateur → accès (non collaborateur du centre)', async () => {
    armerCollaborateur(null);
    await expect(service.verifyAccess(SEJOUR, CREATEUR, 'ORGANISATEUR')).resolves.toMatchObject({ id: SEJOUR });
  });

  it('collaborateur sejours:READ → lecture OK, écriture refusée (droits de modification)', async () => {
    armerCollaborateur({ sejours: 'READ' });
    await expect(service.verifyAccess(SEJOUR, COLLAB, 'HEBERGEUR')).resolves.toMatchObject({ id: SEJOUR });
    await expect(service.verifyAccess(SEJOUR, COLLAB, 'HEBERGEUR', 'WRITE'))
      .rejects.toThrow('droits de modification');
  });

  it('collaborateur sejours:WRITE → lecture ET écriture OK', async () => {
    armerCollaborateur({ sejours: 'WRITE' });
    await expect(service.verifyAccess(SEJOUR, COLLAB, 'HEBERGEUR')).resolves.toMatchObject({ id: SEJOUR });
    await expect(service.verifyAccess(SEJOUR, COLLAB, 'HEBERGEUR', 'WRITE')).resolves.toMatchObject({ id: SEJOUR });
  });

  it('collaborateur sans droit sejours (crm seul) → pas d\'accès', async () => {
    armerCollaborateur({ sejours: 'NONE', crm: 'READ' });
    await expect(service.verifyAccess(SEJOUR, COLLAB, 'HEBERGEUR'))
      .rejects.toThrow('pas accès');
  });

  it('tiers non lié (ni proprio, ni créateur, ni collaborateur) → ForbiddenException', async () => {
    armerCollaborateur(null);
    await expect(service.verifyAccess(SEJOUR, TIERS, 'HEBERGEUR'))
      .rejects.toBeInstanceOf(ForbiddenException);
  });

  it('séjour soft-deleted → NotFoundException', async () => {
    prisma.sejour.findUnique.mockResolvedValue({ ...sejour, deletedAt: new Date() });
    await expect(service.verifyAccess(SEJOUR, OWNER, 'HEBERGEUR')).rejects.toBeInstanceOf(NotFoundException);
  });
});
