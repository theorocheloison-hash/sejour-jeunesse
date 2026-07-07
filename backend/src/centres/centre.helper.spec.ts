import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { assertEnvoiExterneAutorise } from './centre.helper';

/**
 * Mock Prisma minimal : uniquement les délégués utilisés par centre.helper.ts.
 * Aucun accès base réelle — chaque test configure les retours dont il a besoin.
 */
function mockPrisma() {
  return {
    centreHebergement: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    collaborateurCentre: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    membership: {
      findUnique: jest.fn(),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;
const asPrisma = (p: PrismaMock) => p as unknown as PrismaService;

describe('assertEnvoiExterneAutorise', () => {
  let prisma: PrismaMock;

  const USER_EMAIL = 'hebergeur@centre.fr';

  const centreActive = {
    statut: 'ACTIVE',
    nom: 'Centre Test',
    organisationId: 'org-1',
    userId: 'user-1',
  };
  const centrePending = { ...centreActive, statut: 'PENDING' };

  beforeEach(() => {
    prisma = mockPrisma();
  });

  // ── 1. Self-exception : prioritaire sur TOUT ──────────────────────────

  describe('exception auto-envoi (destinataire = compte émetteur)', () => {
    it('autorise l’envoi vers sa propre adresse même si le centre est PENDING', async () => {
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centrePending, USER_EMAIL, USER_EMAIL),
      ).resolves.toBeUndefined();
    });

    it('autorise l’envoi vers sa propre adresse même avec un claim REFUSE (centre ACTIVE)', async () => {
      prisma.membership.findUnique.mockResolvedValue({ claimStatut: 'REFUSE' });
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centreActive, USER_EMAIL, USER_EMAIL),
      ).resolves.toBeUndefined();
      // Prioritaire : la requête membership ne doit même pas partir.
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    });

    it('insensible à la casse', async () => {
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centrePending, 'HeBerGeur@Centre.FR', USER_EMAIL),
      ).resolves.toBeUndefined();
    });

    it('insensible aux espaces autour des adresses', async () => {
      await expect(
        assertEnvoiExterneAutorise(
          asPrisma(prisma),
          centrePending,
          '  hebergeur@centre.fr  ',
          ' hebergeur@centre.fr ',
        ),
      ).resolves.toBeUndefined();
    });

    it('casse ET espaces combinés', async () => {
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centrePending, ' HEBERGEUR@CENTRE.FR ', USER_EMAIL),
      ).resolves.toBeUndefined();
    });

    it('destinataire null ou undefined ne déclenche PAS la self-exception', async () => {
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centrePending, null, USER_EMAIL),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centrePending, undefined, USER_EMAIL),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── 2. Centre non ACTIVE (PENDING) : bloqué ───────────────────────────

  describe('centre non validé (statut !== ACTIVE)', () => {
    it('PENDING + destinataire tiers → ForbiddenException', async () => {
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centrePending, 'tiers@ecole.fr', USER_EMAIL),
      ).rejects.toThrow(ForbiddenException);
    });

    it('le message est préfixé du code machine CENTRE_EN_VALIDATION|', async () => {
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centrePending, 'tiers@ecole.fr', USER_EMAIL),
      ).rejects.toThrow(/^CENTRE_EN_VALIDATION\|/);
    });

    it('le message mentionne l’adresse du compte (guidage vers l’auto-envoi)', async () => {
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centrePending, 'tiers@ecole.fr', USER_EMAIL),
      ).rejects.toThrow(new RegExp(USER_EMAIL));
    });

    it('tout statut non-ACTIVE bloque (ex. SUSPENDED)', async () => {
      await expect(
        assertEnvoiExterneAutorise(
          asPrisma(prisma),
          { ...centreActive, statut: 'SUSPENDED' },
          'tiers@ecole.fr',
          USER_EMAIL,
        ),
      ).rejects.toThrow(/^CENTRE_EN_VALIDATION\|/);
    });

    it('ne consulte jamais membership sur ce chemin (blocage avant la requête)', async () => {
      await assertEnvoiExterneAutorise(
        asPrisma(prisma),
        centrePending,
        'tiers@ecole.fr',
        USER_EMAIL,
      ).catch(() => undefined);
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── 3. Centre ACTIVE : la revendication du propriétaire gouverne ─────

  describe('centre ACTIVE — claim du propriétaire', () => {
    it.each(['EN_ATTENTE_DOCUMENT', 'EN_ATTENTE_VALIDATION', 'REFUSE'])(
      'claimStatut %s → bloqué avec message revendication',
      async (claimStatut) => {
        prisma.membership.findUnique.mockResolvedValue({ claimStatut });
        const promise = assertEnvoiExterneAutorise(
          asPrisma(prisma),
          centreActive,
          'tiers@ecole.fr',
          USER_EMAIL,
        );
        await expect(promise).rejects.toThrow(ForbiddenException);
        await expect(promise).rejects.toThrow(/^CENTRE_EN_VALIDATION\|/);
        await expect(promise).rejects.toThrow(/revendication/);
      },
    );

    it('claimStatut VALIDE → autorisé', async () => {
      prisma.membership.findUnique.mockResolvedValue({ claimStatut: 'VALIDE' });
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centreActive, 'tiers@ecole.fr', USER_EMAIL),
      ).resolves.toBeUndefined();
    });

    it('claimStatut NON_APPLICABLE (comptes historiques admin) → autorisé', async () => {
      prisma.membership.findUnique.mockResolvedValue({ claimStatut: 'NON_APPLICABLE' });
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centreActive, 'tiers@ecole.fr', USER_EMAIL),
      ).resolves.toBeUndefined();
    });

    it('membership absent → autorisé', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(
        assertEnvoiExterneAutorise(asPrisma(prisma), centreActive, 'tiers@ecole.fr', USER_EMAIL),
      ).resolves.toBeUndefined();
    });

    it('centre sans organisationId (legacy) → autorisé sans requête membership', async () => {
      await expect(
        assertEnvoiExterneAutorise(
          asPrisma(prisma),
          { ...centreActive, organisationId: null },
          'tiers@ecole.fr',
          USER_EMAIL,
        ),
      ).resolves.toBeUndefined();
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    });

    it('centre sans userId → autorisé sans requête membership', async () => {
      await expect(
        assertEnvoiExterneAutorise(
          asPrisma(prisma),
          { ...centreActive, userId: null },
          'tiers@ecole.fr',
          USER_EMAIL,
        ),
      ).resolves.toBeUndefined();
      expect(prisma.membership.findUnique).not.toHaveBeenCalled();
    });

    it('la vérification porte sur le PROPRIÉTAIRE du centre (clé composite userId/organisationId)', async () => {
      prisma.membership.findUnique.mockResolvedValue({ claimStatut: 'VALIDE' });
      await assertEnvoiExterneAutorise(asPrisma(prisma), centreActive, 'tiers@ecole.fr', USER_EMAIL);
      expect(prisma.membership.findUnique).toHaveBeenCalledWith({
        where: {
          userId_organisationId: {
            userId: 'user-1',
            organisationId: 'org-1',
          },
        },
        select: { claimStatut: true },
      });
    });
  });
});
