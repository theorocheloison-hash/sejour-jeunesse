import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import {
  assertEnvoiExterneAutorise,
  getCentreForUser,
  getCentresForUser,
  getCentreIdsForUser,
} from './centre.helper';

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

// ─────────────────────────────────────────────────────────────────────────

describe('getCentreForUser', () => {
  let prisma: PrismaMock;

  const OWNER = 'user-owner';
  const COLLAB = 'user-collab';
  const TIERS = 'user-tiers';

  const centre = (statut: string) => ({
    id: 'centre-1',
    nom: 'Centre Test',
    statut,
    userId: OWNER,
  });

  beforeEach(() => {
    prisma = mockPrisma();
  });

  describe('avec centreId explicite', () => {
    it('centre inexistant → NotFoundException', async () => {
      prisma.centreHebergement.findUnique.mockResolvedValue(null);
      await expect(getCentreForUser(asPrisma(prisma), OWNER, 'centre-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('SUSPENDED → 404 pour le PROPRIÉTAIRE lui-même (kill switch)', async () => {
      prisma.centreHebergement.findUnique.mockResolvedValue(centre('SUSPENDED'));
      await expect(getCentreForUser(asPrisma(prisma), OWNER, 'centre-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('SUSPENDED → 404 pour un collaborateur accepté', async () => {
      prisma.centreHebergement.findUnique.mockResolvedValue(centre('SUSPENDED'));
      prisma.collaborateurCentre.findFirst.mockResolvedValue({ id: 'cc-1' });
      await expect(getCentreForUser(asPrisma(prisma), COLLAB, 'centre-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('SUSPENDED → 404 (jamais 403) pour un tiers : indistinguable d’un centre inexistant', async () => {
      prisma.centreHebergement.findUnique.mockResolvedValue(centre('SUSPENDED'));
      await expect(getCentreForUser(asPrisma(prisma), TIERS, 'centre-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('PENDING opérable par son propriétaire', async () => {
      prisma.centreHebergement.findUnique.mockResolvedValue(centre('PENDING'));
      await expect(getCentreForUser(asPrisma(prisma), OWNER, 'centre-1')).resolves.toMatchObject({
        id: 'centre-1',
        statut: 'PENDING',
      });
    });

    it('PENDING opérable par un collaborateur ACCEPTÉ', async () => {
      prisma.centreHebergement.findUnique.mockResolvedValue(centre('PENDING'));
      prisma.collaborateurCentre.findFirst.mockResolvedValue({ id: 'cc-1' });
      await expect(getCentreForUser(asPrisma(prisma), COLLAB, 'centre-1')).resolves.toMatchObject({
        id: 'centre-1',
      });
      // La requête collaborateur exige acceptedAt non null.
      expect(prisma.collaborateurCentre.findFirst).toHaveBeenCalledWith({
        where: { centreId: 'centre-1', userId: COLLAB, acceptedAt: { not: null } },
      });
    });

    it('PENDING + tiers → 404 NotFound, JAMAIS 403 (centre non sondable par ID)', async () => {
      prisma.centreHebergement.findUnique.mockResolvedValue(centre('PENDING'));
      prisma.collaborateurCentre.findFirst.mockResolvedValue(null);
      const promise = getCentreForUser(asPrisma(prisma), TIERS, 'centre-1');
      await expect(promise).rejects.toThrow(NotFoundException);
      await expect(promise).rejects.not.toThrow(ForbiddenException);
    });

    it('ACTIVE + tiers → 403 Forbidden (comportement historique)', async () => {
      prisma.centreHebergement.findUnique.mockResolvedValue(centre('ACTIVE'));
      prisma.collaborateurCentre.findFirst.mockResolvedValue(null);
      await expect(getCentreForUser(asPrisma(prisma), TIERS, 'centre-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('collaborateur NON accepté (invitation en attente) = tiers → 403 sur ACTIVE', async () => {
      prisma.centreHebergement.findUnique.mockResolvedValue(centre('ACTIVE'));
      // Le WHERE filtre acceptedAt not null : une invitation non acceptée retourne null.
      prisma.collaborateurCentre.findFirst.mockResolvedValue(null);
      await expect(getCentreForUser(asPrisma(prisma), COLLAB, 'centre-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('sans centreId (résolution implicite)', () => {
    it('retourne le premier centre possédé non-SUSPENDED', async () => {
      prisma.centreHebergement.findFirst.mockResolvedValue(centre('PENDING'));
      await expect(getCentreForUser(asPrisma(prisma), OWNER)).resolves.toMatchObject({
        id: 'centre-1',
      });
      expect(prisma.centreHebergement.findFirst).toHaveBeenCalledWith({
        where: { userId: OWNER, statut: { not: 'SUSPENDED' } },
      });
    });

    it('fallback collaborateur accepté sur centre non-SUSPENDED', async () => {
      prisma.centreHebergement.findFirst.mockResolvedValue(null);
      prisma.collaborateurCentre.findFirst.mockResolvedValue({ centre: centre('ACTIVE') });
      await expect(getCentreForUser(asPrisma(prisma), COLLAB)).resolves.toMatchObject({
        id: 'centre-1',
      });
      expect(prisma.collaborateurCentre.findFirst).toHaveBeenCalledWith({
        where: {
          userId: COLLAB,
          acceptedAt: { not: null },
          centre: { statut: { not: 'SUSPENDED' } },
        },
        include: { centre: true },
      });
    });

    it('aucun centre accessible → NotFoundException', async () => {
      prisma.centreHebergement.findFirst.mockResolvedValue(null);
      prisma.collaborateurCentre.findFirst.mockResolvedValue(null);
      await expect(getCentreForUser(asPrisma(prisma), TIERS)).rejects.toThrow(NotFoundException);
    });
  });
});

describe('getCentresForUser', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it('fusionne centres possédés + centres collaborés, sans doublon', async () => {
    const c1 = { id: 'c1', nom: 'Possédé' };
    const c2 = { id: 'c2', nom: 'Collaboré' };
    prisma.centreHebergement.findMany.mockResolvedValue([c1]);
    prisma.collaborateurCentre.findMany.mockResolvedValue([
      { centreId: 'c1', centre: c1 }, // aussi possédé → dédupliqué
      { centreId: 'c2', centre: c2 },
    ]);
    const centres = await getCentresForUser(asPrisma(prisma), 'user-1');
    expect(centres.map((c: any) => c.id)).toEqual(['c1', 'c2']);
  });

  it('exclut SUSPENDED des deux requêtes (possédés et collaborés)', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([]);
    prisma.collaborateurCentre.findMany.mockResolvedValue([]);
    await getCentresForUser(asPrisma(prisma), 'user-1');
    expect(prisma.centreHebergement.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', statut: { not: 'SUSPENDED' } },
    });
    expect(prisma.collaborateurCentre.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        acceptedAt: { not: null },
        centre: { statut: { not: 'SUSPENDED' } },
      },
      include: { centre: true },
    });
  });

  it('le filtre collaborateur exige une invitation ACCEPTÉE (acceptedAt non null)', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([]);
    prisma.collaborateurCentre.findMany.mockResolvedValue([]);
    await getCentresForUser(asPrisma(prisma), 'user-1');
    const arg = prisma.collaborateurCentre.findMany.mock.calls[0][0];
    expect(arg.where.acceptedAt).toEqual({ not: null });
  });
});

describe('getCentreIdsForUser', () => {
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = mockPrisma();
  });

  it('sans centreId : union dédupliquée des IDs possédés + collaborés', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
    prisma.collaborateurCentre.findMany.mockResolvedValue([
      { centreId: 'c2' },
      { centreId: 'c3' },
    ]);
    const ids = await getCentreIdsForUser(asPrisma(prisma), 'user-1');
    expect(ids.sort()).toEqual(['c1', 'c2', 'c3']);
  });

  it('sans centreId : SUSPENDED exclu des deux requêtes', async () => {
    prisma.centreHebergement.findMany.mockResolvedValue([]);
    prisma.collaborateurCentre.findMany.mockResolvedValue([]);
    await getCentreIdsForUser(asPrisma(prisma), 'user-1');
    expect(prisma.centreHebergement.findMany.mock.calls[0][0].where.statut).toEqual({
      not: 'SUSPENDED',
    });
    expect(prisma.collaborateurCentre.findMany.mock.calls[0][0].where.centre).toEqual({
      statut: { not: 'SUSPENDED' },
    });
  });

  it('avec centreId : délègue à getCentreForUser et retourne [centreId]', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue({
      id: 'c1',
      statut: 'ACTIVE',
      userId: 'user-1',
    });
    await expect(getCentreIdsForUser(asPrisma(prisma), 'user-1', 'c1')).resolves.toEqual(['c1']);
  });

  it('avec centreId inaccessible (SUSPENDED) : propage NotFoundException', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue({
      id: 'c1',
      statut: 'SUSPENDED',
      userId: 'user-1',
    });
    await expect(getCentreIdsForUser(asPrisma(prisma), 'user-1', 'c1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('avec centreId d’un tiers sur centre ACTIVE : propage ForbiddenException', async () => {
    prisma.centreHebergement.findUnique.mockResolvedValue({
      id: 'c1',
      statut: 'ACTIVE',
      userId: 'autre-user',
    });
    prisma.collaborateurCentre.findFirst.mockResolvedValue(null);
    await expect(getCentreIdsForUser(asPrisma(prisma), 'user-1', 'c1')).rejects.toThrow(
      ForbiddenException,
    );
  });
});
