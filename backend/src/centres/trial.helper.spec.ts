import type { PrismaService } from '../prisma/prisma.service';
import { demarrerOuAlignerTrial } from './trial.helper';

/**
 * Tests de la source unique de démarrage de l'essai gratuit
 * (demarrerOuAlignerTrial), appelée par login, validerClaim, activerCentre et
 * validerHebergeur. Lots 2e + L3c : l'essai est porté par l'ORGANISATION
 * seule, les centres ne sont jamais écrits (héritage par lecture org).
 * Prisma mocké : on vérifie les gardes (org payante, offerte, essai déjà
 * consommé), l'invariant PENDING (aucun centre exploité → aucun essai), et le
 * NO-OP strict (zéro update) sur les retours.
 */

const ORG_ID = 'org-1';
const JOUR_MS = 86400000;

function org(over: Partial<Record<string, unknown>> = {}) {
  return {
    mollieMandatId: null,
    modePaiement: null,
    abonnementStatut: 'INACTIF',
    trialStartedAt: null,
    abonnementActifJusquAu: null,
    ...over,
  };
}

function centre(over: Partial<Record<string, unknown>> = {}) {
  return { id: 'centre-1', nom: 'Centre A', userId: 'user-1', ...over };
}

function mockPrisma() {
  return {
    organisation: {
      findUnique: jest.fn().mockResolvedValue(org()),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'heb@centre.fr', prenom: 'Jean', nom: 'Dupont' }),
    },
    centreHebergement: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

describe('demarrerOuAlignerTrial (Lot 2e — essai porté par l organisation)', () => {
  let prisma: PrismaMock;
  let email: { sendNotifAdmin: jest.Mock };
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = mockPrisma();
    email = { sendNotifAdmin: jest.fn().mockResolvedValue(undefined) };
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const run = () => demarrerOuAlignerTrial(prisma as unknown as PrismaService, email, ORG_ID);

  const expectNoOp = () => {
    expect(prisma.organisation.update).not.toHaveBeenCalled();
    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
    expect(email.sendNotifAdmin).not.toHaveBeenCalled();
  };

  it('(a) organisation payante (mandat Mollie) → NO-OP strict', async () => {
    prisma.organisation.findUnique.mockResolvedValue(org({ mollieMandatId: 'mdt_1', abonnementStatut: 'ACTIF' }));
    await run();
    expectNoOp();
    expect(prisma.centreHebergement.findMany).not.toHaveBeenCalled();
  });

  it('(a) organisation VIREMENT (Choucas) → NO-OP strict', async () => {
    prisma.organisation.findUnique.mockResolvedValue(org({ modePaiement: 'VIREMENT', abonnementStatut: 'ACTIF' }));
    await run();
    expectNoOp();
  });

  it('(b) abonnement offert (ACTIF sans trial ni mandat, Sauvageon) → NO-OP strict', async () => {
    prisma.organisation.findUnique.mockResolvedValue(org({ abonnementStatut: 'ACTIF' }));
    await run();
    expectNoOp();
  });

  it('(d-vide) org vierge SANS centre ACTIVE exploité → aucun essai (invariant PENDING)', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([]);
    await run();
    expect(prisma.organisation.update).not.toHaveBeenCalled();
    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
    expect(email.sendNotifAdmin).not.toHaveBeenCalled();
  });

  it('(d) org vierge AVEC centre exploité → nouvel essai Pilotage 30j sur l org SEULE + notif « Nouveau trial »', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([centre()]);
    await run();

    // Write ORG
    const orgArg = prisma.organisation.update.mock.calls[0][0];
    expect(orgArg.where).toEqual({ id: ORG_ID });
    expect(orgArg.data.planAbonnement).toBe('PILOTAGE');
    expect(orgArg.data.abonnementStatut).toBe('ACTIF');
    expect(orgArg.data.trialStartedAt).toBeInstanceOf(Date);
    expect(orgArg.data.abonnementActifJusquAu).toBeInstanceOf(Date);
    const dureeMs = orgArg.data.abonnementActifJusquAu.getTime() - orgArg.data.trialStartedAt.getTime();
    expect(dureeMs).toBeGreaterThan(29 * JOUR_MS - 3600000);
    expect(dureeMs).toBeLessThanOrEqual(30 * JOUR_MS + 3600000);

    // L3c : les centres ne sont jamais écrits
    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();

    expect(email.sendNotifAdmin).toHaveBeenCalledTimes(1);
    expect(email.sendNotifAdmin.mock.calls[0][0]).toBe('[Admin] Nouveau trial — Centre A');
  });

  it('(c) essai en cours → NO-OP strict, les nouveaux centres héritent par lecture org (L3c)', async () => {
    prisma.organisation.findUnique.mockResolvedValue(
      org({
        trialStartedAt: new Date(Date.now() - 10 * JOUR_MS),
        abonnementActifJusquAu: new Date(Date.now() + 20 * JOUR_MS),
        abonnementStatut: 'ACTIF',
      }),
    );
    await run();
    expectNoOp();
    expect(prisma.centreHebergement.findMany).not.toHaveBeenCalled();
  });

  it('(c-expiré) essai expiré → aucun nouvel essai, NO-OP strict (pas même de findMany)', async () => {
    prisma.organisation.findUnique.mockResolvedValue(
      org({
        trialStartedAt: new Date(Date.now() - 60 * JOUR_MS),
        abonnementActifJusquAu: new Date(Date.now() - 30 * JOUR_MS),
        abonnementStatut: 'INACTIF',
      }),
    );
    await run();
    expectNoOp();
    expect(prisma.centreHebergement.findMany).not.toHaveBeenCalled();
  });

  it('organisation introuvable → NO-OP strict', async () => {
    prisma.organisation.findUnique.mockResolvedValue(null);
    await run();
    expectNoOp();
  });
});
