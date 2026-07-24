import type { PrismaService } from '../prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RoomingService } from './rooming.service';

/**
 * Tests RoomingService : stats (mapping groupBy dont null → aCategoriser) et
 * affectation participant→chambre (XOR, gate créateur, gate plan manuel,
 * capacité dure D7, move sans doublon). getCentreForUser est le VRAI helper
 * (pas de jest.mock) : ses délégués Prisma sont mockés.
 */

function mockPrisma() {
  const prisma = {
    centreHebergement: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'centre-1',
        userId: 'user-1',
        statut: 'ACTIVE',
        // Plan effectif COMPLET (gate manuel organisateur)
        abonnementStatut: 'ACTIF',
        abonnementActifJusquAu: new Date('2099-01-01'),
        planAbonnement: 'COMPLET',
      }),
    },
    collaborateurCentre: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    sejour: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'sejour-1',
        deletedAt: null,
        hebergementSelectionneId: 'centre-1',
        createurId: 'orga-1',
        hebergementSelectionne: { userId: 'hebergeur-1' },
      }),
    },
    autorisationParentale: {
      groupBy: jest.fn().mockResolvedValue([
        { hebergementCategorie: 'FILLE', _count: { _all: 12 } },
        { hebergementCategorie: 'GARCON', _count: { _all: 10 } },
        { hebergementCategorie: null, _count: { _all: 3 } },
      ]),
      findUnique: jest.fn().mockResolvedValue({ sejourId: 'sejour-1' }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    accompagnateurMission: {
      count: jest.fn().mockResolvedValue(4),
      findUnique: jest.fn().mockResolvedValue({ sejourId: 'sejour-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      // Accès rooming : null = pas accompagnateur-collaborateur du séjour
      findFirst: jest.fn().mockResolvedValue(null),
    },
    occupationChambre: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue({
        id: 'occ-1',
        chambreId: 'chambre-1',
        chambre: { lits: [{ places: 2 }, { places: 2 }] }, // capacité 4
      }),
    },
    affectationChambre: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'aff-new',
        ...data,
      })),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        id: where.id,
        ...data,
      })),
      delete: jest.fn().mockResolvedValue({}),
    },
    $transaction: undefined as unknown as jest.Mock,
  };
  prisma.$transaction = jest.fn(async (cb: (tx: typeof prisma) => Promise<unknown>) => cb(prisma));
  return prisma;
}

type PrismaMock = ReturnType<typeof mockPrisma>;

function makeService(prisma: PrismaMock) {
  return new RoomingService(prisma as unknown as PrismaService);
}

// ── getRoomingStats (hébergeur) ─────────────────────────────────────────────

describe('RoomingService.getRoomingStats', () => {
  it('mappe le groupBy (null → aCategoriser) et compte les encadrants', async () => {
    const prisma = mockPrisma();
    const stats = await makeService(prisma).getRoomingStats('user-1', 'centre-1', 'sejour-1');
    expect(stats).toEqual({
      elevesTotal: 25,
      filles: 12,
      garcons: 10,
      autre: 0,
      aCategoriser: 3,
      encadrants: 4,
    });
    // Aucun filtre signeeAt : tous les élèves saisis comptent
    expect(prisma.autorisationParentale.groupBy).toHaveBeenCalledWith({
      by: ['hebergementCategorie'],
      where: { sejourId: 'sejour-1' },
      _count: { _all: true },
    });
    expect(prisma.accompagnateurMission.count).toHaveBeenCalledWith({
      where: { sejourId: 'sejour-1' },
    });
  });

  it('zéro participant → tout à 0 (groupBy vide)', async () => {
    const prisma = mockPrisma();
    prisma.autorisationParentale.groupBy.mockResolvedValue([]);
    prisma.accompagnateurMission.count.mockResolvedValue(0);
    const stats = await makeService(prisma).getRoomingStats('user-1', 'centre-1', 'sejour-1');
    expect(stats).toEqual({
      elevesTotal: 0,
      filles: 0,
      garcons: 0,
      autre: 0,
      aCategoriser: 0,
      encadrants: 0,
    });
  });

  it('400 si sejourId absent', async () => {
    const prisma = mockPrisma();
    await expect(
      makeService(prisma).getRoomingStats('user-1', 'centre-1', ''),
    ).rejects.toThrow(BadRequestException);
  });

  it('404 si le séjour est soft-supprimé', async () => {
    const prisma = mockPrisma();
    prisma.sejour.findUnique.mockResolvedValue({
      id: 'sejour-1',
      deletedAt: new Date('2026-01-01'),
      hebergementSelectionneId: 'centre-1',
      createurId: 'orga-1',
    });
    await expect(
      makeService(prisma).getRoomingStats('user-1', 'centre-1', 'sejour-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it("403 si le séjour appartient à un autre centre", async () => {
    const prisma = mockPrisma();
    prisma.sejour.findUnique.mockResolvedValue({
      id: 'sejour-1',
      deletedAt: null,
      hebergementSelectionneId: 'centre-autre',
      createurId: 'orga-1',
    });
    await expect(
      makeService(prisma).getRoomingStats('user-1', 'centre-1', 'sejour-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});

// ── affecter (organisateur) ─────────────────────────────────────────────────

describe('RoomingService.affecter', () => {
  it('crée une affectation élève (litId null, occupation du séjour)', async () => {
    const prisma = mockPrisma();
    await makeService(prisma).affecter('orga-1', 'sejour-1', 'chambre-1', {
      autorisationId: 'auto-1',
    });
    expect(prisma.affectationChambre.create).toHaveBeenCalledWith({
      data: {
        occupationId: 'occ-1',
        sejourId: 'sejour-1',
        autorisationId: 'auto-1',
        accompagnateurId: null,
        litId: null,
      },
    });
  });

  it('400 si XOR violé (les deux participants, ou aucun)', async () => {
    const prisma = mockPrisma();
    const service = makeService(prisma);
    await expect(
      service.affecter('orga-1', 'sejour-1', 'chambre-1', {
        autorisationId: 'auto-1',
        accompagnateurId: 'acc-1',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.affecter('orga-1', 'sejour-1', 'chambre-1', {}),
    ).rejects.toThrow(BadRequestException);
  });

  it("403 si l'appelant n'est ni créateur ni accompagnateur-collaborateur", async () => {
    const prisma = mockPrisma();
    await expect(
      makeService(prisma).affecter('orga-INTRUS', 'sejour-1', 'chambre-1', {
        autorisationId: 'auto-1',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.affectationChambre.create).not.toHaveBeenCalled();
  });

  it('accompagnateur EDITION : affecter autorisé (aligné groupes)', async () => {
    const prisma = mockPrisma();
    prisma.accompagnateurMission.findFirst.mockResolvedValue({ roleCollaboratif: 'EDITION' });
    await makeService(prisma).affecter('accomp-1', 'sejour-1', 'chambre-1', {
      autorisationId: 'auto-1',
    });
    expect(prisma.accompagnateurMission.findFirst).toHaveBeenCalledWith({
      where: { sejourId: 'sejour-1', userId: 'accomp-1', accesCollaboratif: true },
      select: { roleCollaboratif: true },
    });
    expect(prisma.affectationChambre.create).toHaveBeenCalled();
  });

  it('accompagnateur LECTURE : 403 sur affecter (écriture)', async () => {
    const prisma = mockPrisma();
    prisma.accompagnateurMission.findFirst.mockResolvedValue({ roleCollaboratif: 'LECTURE' });
    await expect(
      makeService(prisma).affecter('accomp-1', 'sejour-1', 'chambre-1', {
        autorisationId: 'auto-1',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.affectationChambre.create).not.toHaveBeenCalled();
  });

  it('403 PLAN_INSUFFICIENT si le centre du séjour est sous COMPLET', async () => {
    const prisma = mockPrisma();
    prisma.centreHebergement.findUnique.mockResolvedValue({
      id: 'centre-1',
      userId: 'user-1',
      statut: 'ACTIVE',
      abonnementStatut: 'EXPIRE', // → plan effectif DECOUVERTE
      abonnementActifJusquAu: null,
      planAbonnement: 'COMPLET',
    });
    let err: unknown;
    try {
      await makeService(prisma).affecter('orga-1', 'sejour-1', 'chambre-1', {
        autorisationId: 'auto-1',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({
      error: 'PLAN_INSUFFICIENT',
      planRequired: 'COMPLET',
    });
  });

  it('400 si la chambre n\'est pas attribuée au séjour', async () => {
    const prisma = mockPrisma();
    prisma.occupationChambre.findFirst.mockResolvedValue(null);
    await expect(
      makeService(prisma).affecter('orga-1', 'sejour-1', 'chambre-1', {
        autorisationId: 'auto-1',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('409 capacité DURE atteinte (D7) — jamais de dépassement', async () => {
    const prisma = mockPrisma();
    prisma.affectationChambre.count.mockResolvedValue(4); // capacité = 4
    await expect(
      makeService(prisma).affecter('orga-1', 'sejour-1', 'chambre-1', {
        autorisationId: 'auto-1',
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.affectationChambre.create).not.toHaveBeenCalled();
    expect(prisma.affectationChambre.update).not.toHaveBeenCalled();
  });

  it('MOVE : une affectation existante est déplacée (update), jamais doublée', async () => {
    const prisma = mockPrisma();
    prisma.affectationChambre.findFirst.mockResolvedValue({
      id: 'aff-1',
      occupationId: 'occ-AUTRE',
    });
    await makeService(prisma).affecter('orga-1', 'sejour-1', 'chambre-1', {
      autorisationId: 'auto-1',
    });
    expect(prisma.affectationChambre.update).toHaveBeenCalledWith({
      where: { id: 'aff-1' },
      data: { occupationId: 'occ-1', litId: null },
    });
    expect(prisma.affectationChambre.create).not.toHaveBeenCalled();
  });

  it('re-drop sur la même chambre → no-op (retourne l\'existante)', async () => {
    const prisma = mockPrisma();
    const existante = { id: 'aff-1', occupationId: 'occ-1' };
    prisma.affectationChambre.findFirst.mockResolvedValue(existante);
    const res = await makeService(prisma).affecter('orga-1', 'sejour-1', 'chambre-1', {
      autorisationId: 'auto-1',
    });
    expect(res).toBe(existante);
    expect(prisma.affectationChambre.count).not.toHaveBeenCalled();
    expect(prisma.affectationChambre.update).not.toHaveBeenCalled();
    expect(prisma.affectationChambre.create).not.toHaveBeenCalled();
  });
});

// ── getRooming — accès collaborateur ────────────────────────────────────────

describe('RoomingService.getRooming (accès)', () => {
  it('accompagnateur LECTURE : getRooming autorisé (lecture seule suffit)', async () => {
    const prisma = mockPrisma();
    prisma.accompagnateurMission.findFirst.mockResolvedValue({ roleCollaboratif: 'LECTURE' });
    const res = await makeService(prisma).getRooming('accomp-1', 'sejour-1');
    expect(res).toEqual({ chambres: [], nonAffectes: { eleves: [], encadrants: [] } });
  });

  it('utilisateur non lié : 403', async () => {
    const prisma = mockPrisma();
    await expect(makeService(prisma).getRooming('orga-INTRUS', 'sejour-1')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("hébergeur du centre : lecture autorisée (impression/accueil)", async () => {
    const prisma = mockPrisma();
    const res = await makeService(prisma).getRooming('hebergeur-1', 'sejour-1');
    expect(res).toEqual({ chambres: [], nonAffectes: { eleves: [], encadrants: [] } });
    // Pas passé par la branche accompagnateur
    expect(prisma.accompagnateurMission.findFirst).not.toHaveBeenCalled();
  });

  it('hébergeur du centre : 403 en écriture (filet service)', async () => {
    const prisma = mockPrisma();
    await expect(
      makeService(prisma).affecter('hebergeur-1', 'sejour-1', 'chambre-1', {
        autorisationId: 'auto-1',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.affectationChambre.create).not.toHaveBeenCalled();
  });

  it('getRooming ne gate plus le plan (lecture soft, plan expiré ok)', async () => {
    const prisma = mockPrisma();
    prisma.centreHebergement.findUnique.mockResolvedValue({
      id: 'centre-1',
      userId: 'user-1',
      statut: 'ACTIVE',
      abonnementStatut: 'EXPIRE',
      abonnementActifJusquAu: null,
      planAbonnement: 'COMPLET',
    });
    await expect(makeService(prisma).getRooming('orga-1', 'sejour-1')).resolves.toEqual({
      chambres: [],
      nonAffectes: { eleves: [], encadrants: [] },
    });
  });
});

// ── retirer (organisateur) ──────────────────────────────────────────────────

describe('RoomingService.retirer', () => {
  it('supprime l\'affectation après le gate créateur', async () => {
    const prisma = mockPrisma();
    prisma.affectationChambre.findUnique.mockResolvedValue({
      id: 'aff-1',
      sejourId: 'sejour-1',
    });
    const res = await makeService(prisma).retirer('orga-1', 'aff-1');
    expect(res).toEqual({ deleted: true });
    expect(prisma.affectationChambre.delete).toHaveBeenCalledWith({ where: { id: 'aff-1' } });
  });

  it('404 si affectation introuvable', async () => {
    const prisma = mockPrisma();
    prisma.affectationChambre.findUnique.mockResolvedValue(null);
    await expect(makeService(prisma).retirer('orga-1', 'aff-inconnue')).rejects.toThrow(
      NotFoundException,
    );
  });

  it("403 si l'appelant n'est pas le créateur du séjour de l'affectation", async () => {
    const prisma = mockPrisma();
    prisma.affectationChambre.findUnique.mockResolvedValue({
      id: 'aff-1',
      sejourId: 'sejour-1',
    });
    await expect(makeService(prisma).retirer('orga-INTRUS', 'aff-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.affectationChambre.delete).not.toHaveBeenCalled();
  });
});
