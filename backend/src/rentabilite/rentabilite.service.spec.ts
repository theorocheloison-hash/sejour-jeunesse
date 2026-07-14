import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { RentabiliteService } from './rentabilite.service.js';

/**
 * getTvaSurMarge — TVA sur marge (art. 266-1-e CGI), Prisma mocké.
 * Invariants verrouillés : ordre des arrondis (tva DÉRIVÉE de marge − baseHT,
 * donc baseHT + tva === margeTTC au centime), marge négative conservée signée
 * (aucune règle fiscale), rattachement mensuel = dateDebut, totaux = somme des
 * 12 mois déjà arrondis, exactement 4 requêtes.
 */

const round2 = (n: number) => Math.round(n * 100) / 100;

function sejour(overrides: Record<string, unknown> = {}) {
  return {
    id: 's-1',
    titre: 'Classe verte',
    dateDebut: new Date(Date.UTC(2026, 2, 15)),
    natureSejour: 'SEJOUR',
    ventilationsPrestataires: [],
    ...overrides,
  };
}

function devis(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd-1',
    isComplementaire: false,
    sejourDirectId: 's-1',
    demande: null,
    lignes: [],
    ...overrides,
  };
}

/** Part d'achat ventilée sur un séjour (Q1 : traversée vers la facture). */
function ventilation(montantTTC: number, typeCharge = 'ESF', factureId = 'fp-1') {
  return { montantTTC, facture: { id: factureId, typeCharge } };
}

/** Facture prestataire pour Q3, intégralement ventilée par défaut. */
function facturePresta(
  montantTotalTTC: number,
  montantsVentiles: number[] = [montantTotalTTC],
  overrides: Record<string, unknown> = {},
) {
  return {
    id: 'fp-1',
    nomPrestataire: 'ESF Alpe',
    montantTotalTTC,
    ventilations: montantsVentiles.map((m) => ({ montantTTC: m })),
    ...overrides,
  };
}

function mockDeps({
  centre = {},
  sejours = [],
  sejoursSansDate = [],
  devisList = [],
  facturesPrestataires = [],
}: {
  centre?: Record<string, unknown>;
  sejours?: unknown[];
  sejoursSansDate?: unknown[];
  devisList?: unknown[];
  facturesPrestataires?: unknown[];
} = {}) {
  const prisma = {
    centreHebergement: {
      // getCentreForUser avec centreId → findUnique, propriétaire = user-1
      findUnique: jest.fn(async () => ({
        id: 'centre-1',
        userId: 'user-1',
        statut: 'ACTIVE',
        regimeMargeActif: true,
        tauxTvaMarge: 20,
        ...centre,
      })),
    },
    sejour: {
      // Q1 (dateDebut: {gte, lte}) puis Q4 (dateDebut: null)
      findMany: jest.fn(async ({ where }: { where: { dateDebut: unknown } }) =>
        where.dateDebut === null ? sejoursSansDate : sejours,
      ),
    },
    devis: { findMany: jest.fn(async () => devisList) },
    facturePrestataire: { findMany: jest.fn(async () => facturesPrestataires) },
  };
  const service = new RentabiliteService(
    prisma as unknown as PrismaService,
    {} as unknown as StorageService,
  );
  return { prisma, service };
}

describe('RentabiliteService.getTvaSurMarge', () => {
  it('1. regimeMargeActif = false → BadRequestException', async () => {
    const { service } = mockDeps({ centre: { regimeMargeActif: false } });
    await expect(
      service.getTvaSurMarge('user-1', 'centre-1', 2026),
    ).rejects.toThrow(BadRequestException);
  });

  it('2. marge négative conservée signée : vente 3400 / achat 3582.38 → −182.38 / −151.98 / −30.40, sans anomalie', async () => {
    const { service, prisma } = mockDeps({
      sejours: [sejour({ ventilationsPrestataires: [ventilation(3582.38)] })],
      devisList: [devis({ lignes: [{ totalTTC: 3400, categorieMarge: 'ESF' }] })],
      facturesPrestataires: [facturePresta(3582.38)],
    });

    const res = await service.getTvaSurMarge('user-1', 'centre-1', 2026);

    const mars = res.parMois[2];
    expect(mars.venteTTC).toBe(3400);
    expect(mars.achatTTC).toBe(3582.38);
    expect(mars.margeTTC).toBe(-182.38);
    expect(mars.baseHT).toBe(-151.98);
    expect(mars.tva).toBe(-30.4);
    // tva dérivée (marge − baseHT) : l'invariant comptable tient au centime
    expect(mars.baseHT + mars.tva).toBeCloseTo(mars.margeTTC, 2);
    expect(res.anomalies).toEqual([]);

    // Exactement 4 requêtes, aucune dans une boucle
    expect(prisma.sejour.findMany).toHaveBeenCalledTimes(2); // Q1 + Q4
    expect(prisma.devis.findMany).toHaveBeenCalledTimes(1); // Q2
    expect(prisma.facturePrestataire.findMany).toHaveBeenCalledTimes(1); // Q3
  });

  it('3. vente 13020 / achat 12128.38 → marge 891.62, baseHT 743.02, tva 148.60', async () => {
    const { service } = mockDeps({
      sejours: [sejour({ ventilationsPrestataires: [ventilation(12128.38)] })],
      devisList: [devis({ lignes: [{ totalTTC: 13020, categorieMarge: 'ESF' }] })],
      facturesPrestataires: [facturePresta(12128.38)],
    });

    const res = await service.getTvaSurMarge('user-1', 'centre-1', 2026);

    const mars = res.parMois[2];
    expect(mars.margeTTC).toBe(891.62);
    expect(mars.baseHT).toBe(743.02);
    expect(mars.tva).toBe(148.6);
    expect(mars.baseHT + mars.tva).toBeCloseTo(mars.margeTTC, 2);
  });

  it('4. devis principal + complémentaire flagués → les DEUX comptés, sans anomalie de double comptage', async () => {
    const { service } = mockDeps({
      sejours: [sejour({ ventilationsPrestataires: [ventilation(900)] })],
      devisList: [
        devis({ id: 'd-1', lignes: [{ totalTTC: 1000, categorieMarge: 'ESF' }] }),
        devis({
          id: 'd-2',
          isComplementaire: true,
          lignes: [{ totalTTC: 500, categorieMarge: 'ESF' }],
        }),
      ],
      facturesPrestataires: [facturePresta(900)],
    });

    const res = await service.getTvaSurMarge('user-1', 'centre-1', 2026);

    expect(res.parMois[2].venteTTC).toBe(1500);
    expect(
      res.anomalies.filter((a) => a.type === 'PLUSIEURS_DEVIS_PRINCIPAUX'),
    ).toEqual([]);
  });

  it('5. achat > 0 sans aucune ligne flaguée → anomalie ACHAT_SANS_VENTE', async () => {
    const { service } = mockDeps({
      sejours: [sejour({ ventilationsPrestataires: [ventilation(500)] })],
      devisList: [devis({ lignes: [] })],
      facturesPrestataires: [facturePresta(500)],
    });

    const res = await service.getTvaSurMarge('user-1', 'centre-1', 2026);

    expect(res.anomalies).toEqual([
      expect.objectContaining({
        type: 'ACHAT_SANS_VENTE',
        sejourId: 's-1',
        montant: 500,
      }),
    ]);
  });

  it('6. facture 3000 ventilée à 2400 → anomalie FACTURE_SOUS_VENTILEE, montant 600', async () => {
    const { service } = mockDeps({
      facturesPrestataires: [
        facturePresta(3000, [2400], { id: 'fp-9', nomPrestataire: 'Rafting 64' }),
      ],
    });

    const res = await service.getTvaSurMarge('user-1', 'centre-1', 2026);

    expect(res.anomalies).toEqual([
      expect.objectContaining({
        type: 'FACTURE_SOUS_VENTILEE',
        factureId: 'fp-9',
        montant: 600,
      }),
    ]);
  });

  it('7. séjour à cheval 28/02 → 07/03 : rattaché à FÉVRIER (dateDebut)', async () => {
    const { service } = mockDeps({
      sejours: [
        sejour({
          dateDebut: new Date(Date.UTC(2026, 1, 28)),
          ventilationsPrestataires: [ventilation(700)],
        }),
      ],
      devisList: [devis({ lignes: [{ totalTTC: 1200, categorieMarge: 'ESF' }] })],
      facturesPrestataires: [facturePresta(700)],
    });

    const res = await service.getTvaSurMarge('user-1', 'centre-1', 2026);

    expect(res.parMois[1]).toMatchObject({ mois: 2, venteTTC: 1200, achatTTC: 700 });
    expect(res.parMois[2]).toMatchObject({ mois: 3, venteTTC: 0, achatTTC: 0 });
  });

  it('8. devis collaboratif (demande.sejourId, sejourDirectId null) → rattaché à son séjour', async () => {
    const { service } = mockDeps({
      sejours: [sejour({ ventilationsPrestataires: [ventilation(300)] })],
      devisList: [
        devis({
          sejourDirectId: null,
          demande: { sejourId: 's-1' },
          lignes: [{ totalTTC: 800, categorieMarge: 'transport' }],
        }),
      ],
      facturesPrestataires: [facturePresta(300)],
    });

    const res = await service.getTvaSurMarge('user-1', 'centre-1', 2026);

    expect(res.parMois[2].venteTTC).toBe(800);
    expect(res.anomalies.filter((a) => a.type === 'ACHAT_SANS_VENTE')).toEqual([]);
  });

  it('9. séjour dateDebut null avec ventilation → anomalie SEJOUR_SANS_DATE', async () => {
    const { service } = mockDeps({
      sejoursSansDate: [{ id: 's-null', titre: 'Séjour sans date' }],
    });

    const res = await service.getTvaSurMarge('user-1', 'centre-1', 2026);

    expect(res.anomalies).toEqual([
      expect.objectContaining({
        type: 'SEJOUR_SANS_DATE',
        sejourId: 's-null',
        titre: 'Séjour sans date',
      }),
    ]);
  });

  it('10. totaux === somme des 12 valeurs mensuelles déjà arrondies', async () => {
    const { service } = mockDeps({
      sejours: [
        sejour({
          id: 's-jan',
          dateDebut: new Date(Date.UTC(2026, 0, 10)),
          ventilationsPrestataires: [ventilation(200.115, 'ESF', 'fp-a')],
        }),
        sejour({
          id: 's-juin',
          dateDebut: new Date(Date.UTC(2026, 5, 20)),
          ventilationsPrestataires: [ventilation(100.005, 'TRANSPORT', 'fp-b')],
        }),
      ],
      devisList: [
        devis({
          id: 'd-jan',
          sejourDirectId: 's-jan',
          lignes: [{ totalTTC: 1000.555, categorieMarge: 'ESF' }],
        }),
        devis({
          id: 'd-juin',
          sejourDirectId: 's-juin',
          lignes: [{ totalTTC: 2000.335, categorieMarge: 'TRANSPORT' }],
        }),
      ],
      facturesPrestataires: [
        facturePresta(200.115, [200.115], { id: 'fp-a' }),
        facturePresta(100.005, [100.005], { id: 'fp-b' }),
      ],
    });

    const res = await service.getTvaSurMarge('user-1', 'centre-1', 2026);

    expect(res.parMois).toHaveLength(12);
    for (const cle of ['venteTTC', 'achatTTC', 'margeTTC', 'baseHT', 'tva'] as const) {
      expect(res.totaux[cle]).toBe(
        round2(res.parMois.reduce((somme, mois) => somme + mois[cle], 0)),
      );
    }
  });
});
