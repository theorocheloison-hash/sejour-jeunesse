import type { PrismaService } from '../prisma/prisma.service';
import { montantRecurrentOrganisationCents } from './montant-organisation.helper';

/**
 * Tests du point de calcul unique montantRecurrentOrganisationCents (patron
 * resync.helper.spec : mocks littéraux, pas de TestingModule). On vérifie le
 * comptage filtré (statut ACTIVE + userId non null), le supplément par plan,
 * la fréquence lue sur l'org (fallback MENSUEL), et les 0 (org absente / plan nul).
 */

const ORG_ID = 'org-1';

function mockPrisma(over: { org?: unknown; count?: number } = {}) {
  return {
    organisation: {
      findUnique: jest.fn().mockResolvedValue(
        'org' in over ? over.org : { planAbonnement: 'PILOTAGE', abonnement: 'MENSUEL' },
      ),
    },
    centreHebergement: {
      count: jest.fn().mockResolvedValue(over.count ?? 1),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

const run = (prisma: PrismaMock) =>
  montantRecurrentOrganisationCents(prisma as unknown as PrismaService, ORG_ID);

describe('montantRecurrentOrganisationCents', () => {
  it('compte les centres exploités avec le filtre exact (ACTIVE + userId non null)', async () => {
    const prisma = mockPrisma({ count: 3 });
    await run(prisma);
    expect(prisma.centreHebergement.count).toHaveBeenCalledWith({
      where: { organisationId: ORG_ID, statut: 'ACTIVE', userId: { not: null } },
    });
  });

  it('PILOTAGE mensuel, 3 centres → 69 + 2×49 = 167,00 € (16700 cts)', async () => {
    const prisma = mockPrisma({ org: { planAbonnement: 'PILOTAGE', abonnement: 'MENSUEL' }, count: 3 });
    expect(await run(prisma)).toBe(16700);
  });

  it('PILOTAGE annuel, 2 centres → 690 + 490 = 1180,00 € (118000 cts)', async () => {
    const prisma = mockPrisma({ org: { planAbonnement: 'PILOTAGE', abonnement: 'ANNUEL' }, count: 2 });
    expect(await run(prisma)).toBe(118000);
  });

  it('mono-centre → prix du plan seul, aucun supplément (PILOTAGE mensuel = 6900 cts)', async () => {
    const prisma = mockPrisma({ org: { planAbonnement: 'PILOTAGE', abonnement: 'MENSUEL' }, count: 1 });
    expect(await run(prisma)).toBe(6900);
  });

  it('COMPLET mensuel, 2 centres → 49 + 29 = 78,00 € (7800 cts)', async () => {
    const prisma = mockPrisma({ org: { planAbonnement: 'COMPLET', abonnement: 'MENSUEL' }, count: 2 });
    expect(await run(prisma)).toBe(7800);
  });

  it('ESSENTIEL mensuel, 3 centres → supplément 0, prix du plan seul (2900 cts)', async () => {
    const prisma = mockPrisma({ org: { planAbonnement: 'ESSENTIEL', abonnement: 'MENSUEL' }, count: 3 });
    expect(await run(prisma)).toBe(2900);
  });

  it('abonnement null → fallback MENSUEL', async () => {
    const prisma = mockPrisma({ org: { planAbonnement: 'PILOTAGE', abonnement: null }, count: 1 });
    expect(await run(prisma)).toBe(6900);
  });

  it('org introuvable (findUnique null) → 0, aucun comptage', async () => {
    const prisma = mockPrisma({ org: null });
    expect(await run(prisma)).toBe(0);
    expect(prisma.centreHebergement.count).not.toHaveBeenCalled();
  });

  it('plan DECOUVERTE → 0 (garde « montant nul » laissé à l appelant)', async () => {
    const prisma = mockPrisma({ org: { planAbonnement: 'DECOUVERTE', abonnement: 'MENSUEL' }, count: 2 });
    expect(await run(prisma)).toBe(0);
  });
});
