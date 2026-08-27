import type { PrismaService } from '../prisma/prisma.service';
import { resyncMontantOrganisation } from './resync-montant.helper';

/**
 * Tests du helper pur resyncMontantOrganisation (patron trial.helper.spec :
 * mocks littéraux, pas de TestingModule). On vérifie les no-op (pas de
 * subscription, org introuvable, montant nul), le calcul du montant avec
 * l'exclusion des fiches catalogue (userId null), le fallback de fréquence,
 * et qu'un échec Mollie ne remonte JAMAIS (fire-and-forget sûr).
 */

const ORG_ID = 'org-1';

function orgAbonnee(over: Partial<Record<string, unknown>> = {}) {
  return {
    mollieSubscriptionId: 'sub_123',
    mollieCustomerId: 'cst_123',
    mollieMandatId: 'mdt_123',
    planAbonnement: 'PILOTAGE',
    abonnement: 'MENSUEL',
    ...over,
  };
}

function mockPrisma() {
  return {
    organisation: {
      findUnique: jest.fn().mockResolvedValue(orgAbonnee()),
    },
    centreHebergement: {
      count: jest.fn().mockResolvedValue(1),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

describe('resyncMontantOrganisation', () => {
  let prisma: PrismaMock;
  let mollie: { customerSubscriptions: { update: jest.Mock } };
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  const run = () =>
    resyncMontantOrganisation(prisma as unknown as PrismaService, mollie, ORG_ID);

  beforeEach(() => {
    prisma = mockPrisma();
    mollie = { customerSubscriptions: { update: jest.fn().mockResolvedValue({}) } };
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  it('no-op sans subscription (mollieSubscriptionId null) : update jamais appelé', async () => {
    prisma.organisation.findUnique.mockResolvedValue(orgAbonnee({ mollieSubscriptionId: null }));

    await run();

    expect(mollie.customerSubscriptions.update).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('no-op org introuvable (findUnique null) : aucun appel Mollie ni comptage', async () => {
    prisma.organisation.findUnique.mockResolvedValue(null);

    await run();

    expect(mollie.customerSubscriptions.update).not.toHaveBeenCalled();
    expect(prisma.centreHebergement.count).not.toHaveBeenCalled();
  });

  it('montant correct pour 3 centres exploités (PILOTAGE mensuel : 69 + 2×49 = 167.00) + where du count', async () => {
    prisma.centreHebergement.count.mockResolvedValue(3);

    await run();

    // L'exclusion des fiches catalogue (userId null) est LE cœur du comptage.
    expect(prisma.centreHebergement.count).toHaveBeenCalledWith({
      where: { organisationId: ORG_ID, statut: 'ACTIVE', userId: { not: null } },
    });
    expect(mollie.customerSubscriptions.update).toHaveBeenCalledWith('sub_123', {
      customerId: 'cst_123',
      mandateId: 'mdt_123',
      amount: { currency: 'EUR', value: '167.00' },
    });
  });

  it('fréquence : abonnement null → fallback MENSUEL', async () => {
    prisma.organisation.findUnique.mockResolvedValue(orgAbonnee({ abonnement: null }));
    prisma.centreHebergement.count.mockResolvedValue(1);

    await run();

    expect(mollie.customerSubscriptions.update).toHaveBeenCalledWith(
      'sub_123',
      expect.objectContaining({ amount: { currency: 'EUR', value: '69.00' } }),
    );
  });

  it("fréquence : abonnement ANNUEL → montant annuel (690 + 490 = 1180.00 pour 2 centres)", async () => {
    prisma.organisation.findUnique.mockResolvedValue(orgAbonnee({ abonnement: 'ANNUEL' }));
    prisma.centreHebergement.count.mockResolvedValue(2);

    await run();

    expect(mollie.customerSubscriptions.update).toHaveBeenCalledWith(
      'sub_123',
      expect.objectContaining({ amount: { currency: 'EUR', value: '1180.00' } }),
    );
  });

  it('échec Mollie non-bloquant : update rejette → la promesse RÉSOUT, console.error appelé', async () => {
    mollie.customerSubscriptions.update.mockRejectedValue(new Error('network down'));

    await expect(run()).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[resync] échec organisation',
      ORG_ID,
      expect.any(Error),
    );
  });

  it('montant nul (plan DECOUVERTE) : return sans appel Mollie', async () => {
    prisma.organisation.findUnique.mockResolvedValue(orgAbonnee({ planAbonnement: 'DECOUVERTE' }));

    await run();

    expect(mollie.customerSubscriptions.update).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('montant nul'),
    );
  });
});
