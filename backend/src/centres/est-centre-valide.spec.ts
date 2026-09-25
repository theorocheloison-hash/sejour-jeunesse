import type { PrismaService } from '../prisma/prisma.service';
import { estCentreValide } from './centre.helper';

/**
 * S1 — prédicat unique de validation d'un centre (source des règles 2 et 3
 * d'assertEnvoiExterneAutorise, consommé par la surface publique de signature
 * et la relance cron).
 */

function prismaAvecClaim(claimStatut: string | null) {
  return {
    membership: {
      findUnique: jest.fn().mockResolvedValue(claimStatut ? { claimStatut } : null),
    },
  } as unknown as PrismaService;
}

describe('estCentreValide', () => {
  it('centre PENDING → non validé (membership jamais consulté)', async () => {
    const prisma = prismaAvecClaim(null);
    await expect(
      estCentreValide(prisma, { statut: 'PENDING', organisationId: 'org-1', userId: 'u-1' }),
    ).resolves.toBe(false);
    expect((prisma as unknown as { membership: { findUnique: jest.Mock } }).membership.findUnique).not.toHaveBeenCalled();
  });

  it.each(['EN_ATTENTE_DOCUMENT', 'EN_ATTENTE_VALIDATION', 'REFUSE'])(
    'centre ACTIVE + claim %s → non validé',
    async (claim) => {
      await expect(
        estCentreValide(prismaAvecClaim(claim), { statut: 'ACTIVE', organisationId: 'org-1', userId: 'u-1' }),
      ).resolves.toBe(false);
    },
  );

  it('centre ACTIVE + claim VALIDE → validé', async () => {
    await expect(
      estCentreValide(prismaAvecClaim('VALIDE'), { statut: 'ACTIVE', organisationId: 'org-1', userId: 'u-1' }),
    ).resolves.toBe(true);
  });

  it('centre ACTIVE + claim NON_APPLICABLE (comptes historiques) → validé', async () => {
    await expect(
      estCentreValide(prismaAvecClaim('NON_APPLICABLE'), { statut: 'ACTIVE', organisationId: 'org-1', userId: 'u-1' }),
    ).resolves.toBe(true);
  });

  it('centre ACTIVE + membership absent → validé', async () => {
    await expect(
      estCentreValide(prismaAvecClaim(null), { statut: 'ACTIVE', organisationId: 'org-1', userId: 'u-1' }),
    ).resolves.toBe(true);
  });

  it('centre ACTIVE legacy sans organisation → validé (membership jamais consulté)', async () => {
    const prisma = prismaAvecClaim(null);
    await expect(
      estCentreValide(prisma, { statut: 'ACTIVE', organisationId: null, userId: 'u-1' }),
    ).resolves.toBe(true);
    expect((prisma as unknown as { membership: { findUnique: jest.Mock } }).membership.findUnique).not.toHaveBeenCalled();
  });
});
