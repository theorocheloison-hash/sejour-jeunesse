import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import type { EmailService } from '../email/email.service';
import { ClaimService } from './claim.service';

/**
 * Porte 1 sur claimFromCatalogue — multi-centre réservé au plan effectif ≥ Complet.
 * Le singleton Mollie est mocké au niveau module (mêmes contraintes que
 * abonnement.service.spec : sans ce mock, l'import du client au chargement casse
 * la suite). On ne teste QUE la garde (elle tranche AVANT tout le pipeline de
 * claim) : blocage d'un vrai 2ᵉ centre + exclusion du centre re-revendiqué.
 */

jest.mock('../abonnements/mollie.client', () => ({ mollieClient: {} }));

const CATALOGUE_UUID = '11111111-1111-1111-1111-111111111111';

function centreExistant(over: Record<string, unknown> = {}) {
  return {
    id: CATALOGUE_UUID,
    userId: 'user-1', // déjà détenu par ce user → pas de blocage « revendiqué par un autre »
    statut: 'ACTIVE',
    organisationId: 'org-x',
    nom: 'Chalet A', ville: 'Vallorcine', codePostal: '74660', adresse: '1 rue', capacite: 40,
    departement: '74', siret: null, description: null, imageUrl: null, capaciteAdultes: null,
    thematiquesCentre: [], activitesCentre: [], accessiblePmr: false, avisSecurite: null,
    periodeOuverture: null,
    ...over,
  };
}

function mockPrisma() {
  return {
    centreHebergement: {
      findUnique: jest.fn().mockResolvedValue(centreExistant()),
      count: jest.fn().mockResolvedValue(0),
    },
    organisation: {
      findUnique: jest.fn().mockResolvedValue({
        abonnementStatut: 'INACTIF', abonnementActifJusquAu: null, planAbonnement: 'DECOUVERTE',
      }),
    },
    membership: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

describe('ClaimService.claimFromCatalogue — Porte 1 multi-centre', () => {
  let prisma: PrismaMock;
  let service: ClaimService;

  const claim = () => service.claimFromCatalogue(CATALOGUE_UUID, 'user-1', 'HEBERGEUR');

  beforeEach(() => {
    prisma = mockPrisma();
    service = new ClaimService(
      prisma as unknown as PrismaService,
      {} as StorageService,
      {} as EmailService,
    );
  });

  it('vrai 2ᵉ centre (un AUTRE centre exploité) + Découverte → 403, count exclut le centre revendiqué', async () => {
    prisma.centreHebergement.count.mockResolvedValue(1); // un centre B, distinct de celui revendiqué

    const err = await claim().catch((e) => e);

    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ error: 'PLAN_INSUFFICIENT', planRequired: 'COMPLET' });
    // L'exclusion `id != existingCentreId` est bien appliquée au comptage.
    expect(prisma.centreHebergement.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { not: CATALOGUE_UUID } }) }),
    );
  });

  it('re-revendication du SEUL centre de l’org (count exclu = 0) → garde FRANCHIE, plan jamais lu', async () => {
    prisma.centreHebergement.count.mockResolvedValue(0); // aucun AUTRE centre exploité
    // On coupe juste après la garde : le 1er accès downstream rejette.
    prisma.membership.findFirst.mockRejectedValue(new Error('__STOP_APRES_GARDE__'));

    const err = await claim().catch((e) => e);

    expect(err.message).toBe('__STOP_APRES_GARDE__'); // pas un 403 : la garde a laissé passer
    expect(prisma.organisation.findUnique).not.toHaveBeenCalled(); // count 0 → pas de lecture du plan
  });

  it('vrai 2ᵉ centre mais plan Complet actif → garde FRANCHIE (pas de 403)', async () => {
    prisma.centreHebergement.count.mockResolvedValue(1);
    prisma.organisation.findUnique.mockResolvedValue({
      abonnementStatut: 'ACTIF',
      abonnementActifJusquAu: new Date(Date.now() + 30 * 86400000),
      planAbonnement: 'COMPLET',
    });
    prisma.membership.findFirst.mockRejectedValue(new Error('__STOP_APRES_GARDE__'));

    const err = await claim().catch((e) => e);

    expect(err.message).toBe('__STOP_APRES_GARDE__');
  });
});
