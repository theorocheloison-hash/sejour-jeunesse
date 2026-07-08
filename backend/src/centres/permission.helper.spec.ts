import type { PrismaService } from '../prisma/prisma.service';
import { getUserCentrePermissions, OWNER_PERMISSIONS } from './permission.helper';

/**
 * Mock Prisma minimal : uniquement les délégués utilisés par permission.helper.ts.
 * Aucun accès base réelle — chaque test configure les retours dont il a besoin.
 */
function mockPrisma() {
  return {
    centreHebergement: {
      findUnique: jest.fn(),
    },
    collaborateurCentre: {
      findFirst: jest.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;
const asPrisma = (p: PrismaMock) => p as unknown as PrismaService;

describe('getUserCentrePermissions', () => {
  let prisma: PrismaMock;

  const OWNER = 'user-owner';
  const COLLAB = 'user-collab';
  const TIERS = 'user-tiers';

  const centre = (statut: string) => ({
    id: 'centre-1',
    nom: 'Centre Test',
    statut,
    userId: OWNER,
  });

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it('centre ACTIVE + propriétaire → OWNER_PERMISSIONS (inchangé)', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue(centre('ACTIVE'));
    await expect(getUserCentrePermissions(asPrisma(prisma), OWNER, 'centre-1')).resolves.toBe(
      OWNER_PERMISSIONS,
    );
  });

  it('centre PENDING + propriétaire → OWNER_PERMISSIONS (le fix : sidebar opérable)', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue(centre('PENDING'));
    await expect(getUserCentrePermissions(asPrisma(prisma), OWNER, 'centre-1')).resolves.toBe(
      OWNER_PERMISSIONS,
    );
  });

  it('centre SUSPENDED + propriétaire → null (kill switch préservé)', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue(centre('SUSPENDED'));
    await expect(
      getUserCentrePermissions(asPrisma(prisma), OWNER, 'centre-1'),
    ).resolves.toBeNull();
    // Court-circuit total : la requête collaborateur ne part même pas.
    expect(prisma.collaborateurCentre.findFirst).not.toHaveBeenCalled();
  });

  it('centre PENDING + collaborateur accepté → ses permissions stockées (isOwner false)', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue(centre('PENDING'));
    prisma.collaborateurCentre.findFirst.mockResolvedValue({
      permissions: { planning: 'WRITE', sejours: 'READ', devis: 'NONE' },
    });

    const perms = await getUserCentrePermissions(asPrisma(prisma), COLLAB, 'centre-1');

    expect(perms).toEqual({
      isOwner: false,
      planning: 'WRITE',
      sejours: 'READ',
      devis: 'NONE',
      crm: 'NONE',
      facturation: 'NONE',
      parametres: 'NONE',
    });
    // Le WHERE exige une invitation ACCEPTÉE.
    expect(prisma.collaborateurCentre.findFirst).toHaveBeenCalledWith({
      where: { centreId: 'centre-1', userId: COLLAB, acceptedAt: { not: null } },
    });
  });

  it('centre PENDING + tiers (ni proprio ni collab) → null', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue(centre('PENDING'));
    prisma.collaborateurCentre.findFirst.mockResolvedValue(null);
    await expect(
      getUserCentrePermissions(asPrisma(prisma), TIERS, 'centre-1'),
    ).resolves.toBeNull();
  });

  it('centre inexistant → null', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue(null);
    await expect(
      getUserCentrePermissions(asPrisma(prisma), OWNER, 'centre-1'),
    ).resolves.toBeNull();
  });
});
