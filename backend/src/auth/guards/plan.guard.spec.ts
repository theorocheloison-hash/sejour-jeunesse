import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { PrismaService } from '../../prisma/prisma.service';
import type { PlanMetadata } from '../decorators/plan.decorator';
import { PlanGuard } from './plan.guard';

/**
 * Le guard résout le centre via getCentreForUser (non mocké) : on pilote donc
 * prisma.centreHebergement.findUnique pour retourner un centre possédé par le
 * user du contexte — le chemin propriétaire du helper suffit ici.
 */
function mockPrisma() {
  return {
    centreHebergement: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    collaborateurCentre: {
      findFirst: jest.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

const USER_ID = 'user-1';
const IN_30_DAYS = new Date(Date.now() + 30 * 86400000);
const YESTERDAY = new Date(Date.now() - 86400000);

function centreAbonnement(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'centre-1',
    userId: USER_ID,
    statut: 'ACTIVE',
    planAbonnement: 'PILOTAGE',
    abonnementStatut: 'ACTIF',
    abonnementActifJusquAu: IN_30_DAYS,
    ...over,
  };
}

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => function handler() {},
    getClass: () => class Controller {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function makeRequest(over: Partial<Record<string, unknown>> = {}) {
  return {
    method: 'POST',
    headers: { 'x-centre-id': 'centre-1' },
    user: { id: USER_ID, role: 'HEBERGEUR' },
    ...over,
  };
}

describe('PlanGuard', () => {
  let prisma: PrismaMock;
  let reflector: { getAllAndOverride: jest.Mock };
  let guard: PlanGuard;

  const setMeta = (meta: PlanMetadata | undefined) =>
    reflector.getAllAndOverride.mockReturnValue(meta);

  beforeEach(() => {
    prisma = mockPrisma();
    reflector = { getAllAndOverride: jest.fn() };
    guard = new PlanGuard(reflector as unknown as Reflector, prisma as unknown as PrismaService);
  });

  // ── Court-circuits (pas de vérification de plan) ──────────────────────

  it('sans decorator @RequirePlan → passe sans consulter la base', async () => {
    setMeta(undefined);
    await expect(guard.canActivate(makeContext(makeRequest()))).resolves.toBe(true);
    expect(prisma.centreHebergement.findUnique).not.toHaveBeenCalled();
  });

  it('sans user sur la requête → passe', async () => {
    setMeta({ plan: 'PILOTAGE', strict: false });
    await expect(guard.canActivate(makeContext(makeRequest({ user: undefined })))).resolves.toBe(
      true,
    );
  });

  it.each(['ORGANISATEUR', 'ADMIN', 'SIGNATAIRE', 'PARENT'])(
    'rôle %s non soumis au PlanGuard → passe',
    async (role) => {
      setMeta({ plan: 'PILOTAGE', strict: false });
      const req = makeRequest({ user: { id: USER_ID, role } });
      await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
      expect(prisma.centreHebergement.findUnique).not.toHaveBeenCalled();
    },
  );

  it('mode soft : GET et HEAD passent sans résolution de centre', async () => {
    setMeta({ plan: 'PILOTAGE', strict: false });
    for (const method of ['GET', 'HEAD', 'get']) {
      await expect(guard.canActivate(makeContext(makeRequest({ method })))).resolves.toBe(true);
    }
    expect(prisma.centreHebergement.findUnique).not.toHaveBeenCalled();
  });

  it('mode strict : les GET sont eux aussi soumis au plan', async () => {
    setMeta({ plan: 'PILOTAGE', strict: true });
    prisma.centreHebergement.findUnique.mockResolvedValue(
      centreAbonnement({ abonnementStatut: 'INACTIF' }),
    );
    await expect(guard.canActivate(makeContext(makeRequest({ method: 'GET' })))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('centre non résoluble (404 du helper) → fail-open, passe', async () => {
    setMeta({ plan: 'PILOTAGE', strict: false });
    prisma.centreHebergement.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(makeContext(makeRequest()))).resolves.toBe(true);
  });

  // ── Plan effectif ─────────────────────────────────────────────────────

  it('ACTIF + expiration future → le plan réel s’applique (PILOTAGE requis, PILOTAGE actif)', async () => {
    setMeta({ plan: 'PILOTAGE', strict: false });
    prisma.centreHebergement.findUnique.mockResolvedValue(centreAbonnement());
    await expect(guard.canActivate(makeContext(makeRequest()))).resolves.toBe(true);
  });

  it('ACTIF mais expiration PASSÉE → rétrogradé DECOUVERTE → 403', async () => {
    setMeta({ plan: 'ESSENTIEL', strict: false });
    prisma.centreHebergement.findUnique.mockResolvedValue(
      centreAbonnement({ abonnementActifJusquAu: YESTERDAY }),
    );
    await expect(guard.canActivate(makeContext(makeRequest()))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('INACTIF même avec date future → DECOUVERTE → 403', async () => {
    setMeta({ plan: 'ESSENTIEL', strict: false });
    prisma.centreHebergement.findUnique.mockResolvedValue(
      centreAbonnement({ abonnementStatut: 'INACTIF' }),
    );
    await expect(guard.canActivate(makeContext(makeRequest()))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('ACTIF sans date d’expiration → DECOUVERTE → 403', async () => {
    setMeta({ plan: 'ESSENTIEL', strict: false });
    prisma.centreHebergement.findUnique.mockResolvedValue(
      centreAbonnement({ abonnementActifJusquAu: null }),
    );
    await expect(guard.canActivate(makeContext(makeRequest()))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('ACTIF + date future mais planAbonnement null → DECOUVERTE → 403', async () => {
    setMeta({ plan: 'ESSENTIEL', strict: false });
    prisma.centreHebergement.findUnique.mockResolvedValue(
      centreAbonnement({ planAbonnement: null }),
    );
    await expect(guard.canActivate(makeContext(makeRequest()))).rejects.toThrow(
      ForbiddenException,
    );
  });

  // ── Hiérarchie DECOUVERTE < ESSENTIEL < COMPLET < PILOTAGE ────────────

  it.each([
    ['PILOTAGE', 'ESSENTIEL', true],
    ['PILOTAGE', 'COMPLET', true],
    ['COMPLET', 'ESSENTIEL', true],
    ['COMPLET', 'COMPLET', true],
    ['ESSENTIEL', 'ESSENTIEL', true],
    ['ESSENTIEL', 'COMPLET', false],
    ['ESSENTIEL', 'PILOTAGE', false],
    ['COMPLET', 'PILOTAGE', false],
  ])('plan actif %s vs requis %s → autorisé=%s', async (actif, requis, autorise) => {
    setMeta({ plan: requis as PlanMetadata['plan'], strict: false });
    prisma.centreHebergement.findUnique.mockResolvedValue(
      centreAbonnement({ planAbonnement: actif }),
    );
    const promise = guard.canActivate(makeContext(makeRequest()));
    if (autorise) {
      await expect(promise).resolves.toBe(true);
    } else {
      await expect(promise).rejects.toThrow(ForbiddenException);
    }
  });

  it('la 403 porte le code PLAN_INSUFFICIENT + planRequired + planActuel', async () => {
    setMeta({ plan: 'PILOTAGE', strict: false });
    prisma.centreHebergement.findUnique.mockResolvedValue(
      centreAbonnement({ planAbonnement: 'ESSENTIEL' }),
    );
    const err = await guard.canActivate(makeContext(makeRequest())).then(
      () => null,
      (e) => e,
    );
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      statusCode: 403,
      error: 'PLAN_INSUFFICIENT',
      planRequired: 'PILOTAGE',
      planActuel: 'ESSENTIEL',
    });
  });

  it('header x-centre-id en tableau → utilise la première valeur', async () => {
    setMeta({ plan: 'ESSENTIEL', strict: false });
    prisma.centreHebergement.findUnique.mockResolvedValue(centreAbonnement());
    const req = makeRequest({ headers: { 'x-centre-id': ['centre-1', 'centre-2'] } });
    await expect(guard.canActivate(makeContext(req))).resolves.toBe(true);
    expect(prisma.centreHebergement.findUnique).toHaveBeenCalledWith({
      where: { id: 'centre-1' },
    });
  });
});
