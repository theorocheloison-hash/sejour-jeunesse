import type { PrismaService } from '../prisma/prisma.service';
import { demarrerOuAlignerTrial } from './trial.helper';

/**
 * Tests de la source unique de démarrage/alignement de l'essai gratuit
 * (demarrerOuAlignerTrial), appelée par login, validerClaim, activerCentre
 * et validerHebergeur. Prisma mocké : on vérifie les gardes (compte payant,
 * abonnement offert, centre PENDING), le démarrage d'un nouvel essai, et
 * l'alignement multi-centre sur un essai en cours (jamais de prolongation).
 */

const JOUR_MS = 86400000;

function mockPrisma() {
  return {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        email: 'heb@centre.fr',
        prenom: 'Jean',
        nom: 'Dupont',
      }),
    },
    centreHebergement: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

function centre(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'centre-1',
    nom: 'Centre A',
    statut: 'ACTIVE',
    trialStartedAt: null,
    abonnementStatut: 'INACTIF',
    abonnementActifJusquAu: null,
    mollieMandatId: null,
    modePaiement: null,
    ...over,
  };
}

describe('demarrerOuAlignerTrial', () => {
  let prisma: PrismaMock;
  let email: { sendNotifAdmin: jest.Mock };
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    prisma = mockPrisma();
    email = { sendNotifAdmin: jest.fn().mockResolvedValue(undefined) };
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const run = () => demarrerOuAlignerTrial(prisma as unknown as PrismaService, email, 'user-1');

  it('mandat Mollie présent sur un centre → aucun essai, même pour un centre éligible', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([
      centre({ id: 'paye', mollieMandatId: 'mdt_123', abonnementStatut: 'ACTIF', trialStartedAt: new Date() }),
      centre({ id: 'nouveau', nom: 'Centre B' }),
    ]);

    await run();

    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
    expect(email.sendNotifAdmin).not.toHaveBeenCalled();
  });

  it('modePaiement VIREMENT (Choucas) → aucun essai, même pour un centre éligible', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([
      centre({ id: 'choucas', modePaiement: 'VIREMENT', abonnementStatut: 'ACTIF' }),
      centre({ id: 'nouveau', nom: 'Centre B' }),
    ]);

    await run();

    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
    expect(email.sendNotifAdmin).not.toHaveBeenCalled();
  });

  it('abonnement ACTIF sans trial ni mandat (Sauvageon, offert) → aucun essai', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([
      centre({ id: 'sauvageon', abonnementStatut: 'ACTIF' }),
      centre({ id: 'nouveau', nom: 'Centre B' }),
    ]);

    await run();

    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
    expect(email.sendNotifAdmin).not.toHaveBeenCalled();
  });

  it('unique centre PENDING → aucun essai (la garde statut ACTIVE mord)', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([centre({ statut: 'PENDING' })]);

    await run();

    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
    expect(email.sendNotifAdmin).not.toHaveBeenCalled();
  });

  it('centre ACTIVE vierge → trial Pilotage 30j + 1 notif admin « Nouveau trial »', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([centre()]);

    await run();

    expect(prisma.centreHebergement.updateMany).toHaveBeenCalledTimes(1);
    const arg = prisma.centreHebergement.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: { in: ['centre-1'] }, trialStartedAt: null });
    expect(arg.data.planAbonnement).toBe('PILOTAGE');
    expect(arg.data.abonnementStatut).toBe('ACTIF');
    expect(arg.data.trialStartedAt).toBeInstanceOf(Date);
    expect(arg.data.abonnementActifJusquAu).toBeInstanceOf(Date);
    // trialExpiration() tronque à minuit UTC : la durée réelle est dans (29j, 30j].
    const dureeMs = arg.data.abonnementActifJusquAu.getTime() - arg.data.trialStartedAt.getTime();
    expect(dureeMs).toBeGreaterThan(29 * JOUR_MS - 3600000);
    expect(dureeMs).toBeLessThanOrEqual(30 * JOUR_MS + 3600000);

    expect(email.sendNotifAdmin).toHaveBeenCalledTimes(1);
    expect(email.sendNotifAdmin.mock.calls[0][0]).toBe('[Admin] Nouveau trial — Centre A');
  });

  it("2e centre ACTIVE, essai en cours → alignement sur la MÊME expiration (aucune prolongation) + notif « ajouté à l'essai »", async () => {
    const trialStart = new Date(Date.now() - 10 * JOUR_MS);
    const trialFin = new Date(Date.now() + 20 * JOUR_MS);
    prisma.centreHebergement.findMany.mockResolvedValue([
      centre({
        id: 'premier',
        trialStartedAt: trialStart,
        abonnementActifJusquAu: trialFin,
        abonnementStatut: 'ACTIF',
        planAbonnement: 'PILOTAGE',
      }),
      centre({ id: 'second', nom: 'Centre B' }),
    ]);

    await run();

    expect(prisma.centreHebergement.updateMany).toHaveBeenCalledTimes(1);
    const arg = prisma.centreHebergement.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ id: { in: ['second'] }, trialStartedAt: null });
    expect(arg.data.trialStartedAt).toBe(trialStart);
    expect(arg.data.abonnementActifJusquAu).toBe(trialFin); // pas de prolongation

    expect(email.sendNotifAdmin).toHaveBeenCalledTimes(1);
    expect(email.sendNotifAdmin.mock.calls[0][0]).toBe(
      "[Admin] Centre ajouté à l'essai en cours — Centre B",
    );
  });

  it('2e centre ACTIVE, essai expiré → aucun nouvel essai (souscription payante attendue)', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([
      centre({
        id: 'premier',
        trialStartedAt: new Date(Date.now() - 60 * JOUR_MS),
        abonnementActifJusquAu: new Date(Date.now() - 30 * JOUR_MS),
        abonnementStatut: 'INACTIF',
      }),
      centre({ id: 'second', nom: 'Centre B' }),
    ]);

    await run();

    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
    expect(email.sendNotifAdmin).not.toHaveBeenCalled();
  });
});
