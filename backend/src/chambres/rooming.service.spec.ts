import type { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoomingService } from './rooming.service';

/**
 * Tests de getRoomingStats : mapping du groupBy (dont le groupe null →
 * aCategoriser) + count encadrants. getCentreForUser est le VRAI helper (pas
 * de jest.mock) : ses délégués Prisma (centreHebergement, collaborateurCentre)
 * sont mockés — propriétaire du centre → passe.
 */

function mockPrisma() {
  return {
    centreHebergement: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'centre-1', userId: 'user-1', statut: 'ACTIVE' }),
    },
    collaborateurCentre: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    sejour: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'sejour-1',
        deletedAt: null,
        hebergementSelectionneId: 'centre-1',
      }),
    },
    autorisationParentale: {
      groupBy: jest.fn().mockResolvedValue([
        { hebergementCategorie: 'FILLE', _count: { _all: 12 } },
        { hebergementCategorie: 'GARCON', _count: { _all: 10 } },
        { hebergementCategorie: null, _count: { _all: 3 } },
      ]),
    },
    accompagnateurMission: {
      count: jest.fn().mockResolvedValue(4),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

function makeService(prisma: PrismaMock) {
  return new RoomingService(prisma as unknown as PrismaService);
}

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
    });
    await expect(
      makeService(prisma).getRoomingStats('user-1', 'centre-1', 'sejour-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});
