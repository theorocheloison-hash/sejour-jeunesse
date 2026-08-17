import { ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import type { ClaimService } from '../organisations/claim.service';
import type { InvitationCollaborationService } from '../invitation-collaboration/invitation-collaboration.service';
import { AuthService } from './auth.service';

/**
 * Tests du trial à la première connexion, délégué à la source unique
 * demarrerOuAlignerTrial (centres/trial.helper) — exercé ici via login().
 * Lot 2e : l'essai est porté par l'ORGANISATION. login() résout les
 * organisations distinctes des centres POSSÉDÉS et appelle le helper une fois
 * par organisation. Les gardes détaillées (payante, offerte, essai en cours)
 * vivent dans trial.helper.spec.ts ; ce fichier vérifie le CÂBLAGE : rôle
 * HEBERGEUR uniquement, jamais avant validation du mot de passe, un appel par
 * org, et échec du helper non bloquant.
 */

const PASSWORD = 'S3cret!password';
let PASSWORD_HASH: string;

function mockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    consentementRgpd: {
      create: jest.fn().mockResolvedValue({}),
    },
    organisation: {
      // Par défaut : org payante → le helper court-circuite après findUnique
      // (on teste le câblage, pas les branches internes du helper).
      findUnique: jest.fn().mockResolvedValue({
        mollieMandatId: 'mdt_1',
        modePaiement: null,
        abonnementStatut: 'ACTIF',
        trialStartedAt: null,
        abonnementActifJusquAu: null,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    centreHebergement: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

function hebergeur(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    email: 'heb@centre.fr',
    prenom: 'Jean',
    nom: 'Dupont',
    role: 'HEBERGEUR',
    motDePasse: PASSWORD_HASH,
    motDePasseDefini: true,
    compteValide: true,
    emailVerifie: true,
    reseauNom: null,
    tokenVersion: 0,
    ...over,
  };
}

describe('AuthService.login — trial première connexion (Lot 2e, scope organisation)', () => {
  let prisma: PrismaMock;
  let email: { sendNotifAdmin: jest.Mock };
  let service: AuthService;
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(async () => {
    PASSWORD_HASH = await bcrypt.hash(PASSWORD, 4);
  });

  beforeEach(() => {
    prisma = mockPrisma();
    email = { sendNotifAdmin: jest.fn().mockResolvedValue(undefined) };
    const jwt = { sign: jest.fn().mockReturnValue('jwt-token') };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      email as unknown as EmailService,
      {} as ClaimService,
      { accepter: jest.fn().mockResolvedValue(undefined) } as unknown as InvitationCollaborationService,
    );
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const login = () => service.login({ email: 'heb@centre.fr', password: PASSWORD } as any);

  it('HEBERGEUR : résout les orgs distinctes des centres POSSÉDÉS (userId + organisationId non null) et appelle le helper', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.findMany.mockResolvedValue([{ organisationId: 'org-1' }]);

    await login();

    expect(prisma.centreHebergement.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', organisationId: { not: null } },
      select: { organisationId: true },
      distinct: ['organisationId'],
    });
    // Le helper a été appelé avec l'org résolue.
    expect(prisma.organisation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org-1' } }),
    );
  });

  it('multi-organisation : un appel helper par organisation distincte', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.findMany.mockResolvedValue([
      { organisationId: 'org-1' },
      { organisationId: 'org-2' },
    ]);

    await login();

    expect(prisma.organisation.findUnique).toHaveBeenCalledTimes(2);
    const ids = prisma.organisation.findUnique.mock.calls.map((c) => c[0].where.id);
    expect(ids).toEqual(expect.arrayContaining(['org-1', 'org-2']));
  });

  it('HEBERGEUR sans centre rattaché à une organisation → aucun appel helper', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.findMany.mockResolvedValue([]);

    const result = await login();

    expect(result.access_token).toBe('jwt-token');
    expect(prisma.organisation.findUnique).not.toHaveBeenCalled();
  });

  it('échec du helper (findUnique rejette) → le login réussit quand même (non bloquant)', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.findMany.mockResolvedValue([{ organisationId: 'org-1' }]);
    prisma.organisation.findUnique.mockRejectedValue(new Error('DB down'));

    const result = await login();

    expect(result.access_token).toBe('jwt-token');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it.each(['ORGANISATEUR', 'ADMIN', 'PARENT', 'RESEAU'])(
    'rôle %s → aucune tentative de trial (pas de résolution d organisations)',
    async (role) => {
      prisma.user.findUnique.mockResolvedValue(hebergeur({ role, compteValide: false }));

      const result = await login();

      expect(result.access_token).toBe('jwt-token');
      expect(prisma.centreHebergement.findMany).not.toHaveBeenCalled();
      expect(prisma.organisation.findUnique).not.toHaveBeenCalled();
    },
  );

  it('login refusé (mauvais mot de passe) → jamais de trial', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    await expect(
      service.login({ email: 'heb@centre.fr', password: 'mauvais' } as any),
    ).rejects.toThrow('Identifiants invalides');
    expect(prisma.centreHebergement.findMany).not.toHaveBeenCalled();
  });

  it('email non vérifié → EMAIL_NON_VERIFIE, jamais de trial', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur({ emailVerifie: false }));
    await expect(login()).rejects.toThrow('EMAIL_NON_VERIFIE');
    expect(prisma.centreHebergement.findMany).not.toHaveBeenCalled();
  });
});

describe('AuthService — portage serveur invitation collaborative (F1)', () => {
  let prisma: PrismaMock;
  let invitationCollab: { accepter: jest.Mock };
  let service: AuthService;
  let consoleErrorSpy: jest.SpyInstance;

  beforeAll(async () => {
    PASSWORD_HASH = await bcrypt.hash(PASSWORD, 4);
  });

  beforeEach(() => {
    prisma = mockPrisma();
    const email = {
      sendNotifAdmin: jest.fn().mockResolvedValue(undefined),
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      notifyAdminNewAccount: jest.fn().mockResolvedValue(undefined),
    };
    const jwt = { sign: jest.fn().mockReturnValue('jwt-token') };
    invitationCollab = { accepter: jest.fn().mockResolvedValue(undefined) };
    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      email as unknown as EmailService,
      {} as ClaimService,
      invitationCollab as unknown as InvitationCollaborationService,
    );
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Appels de purge = updates portant invitationCollabTokenPending dans data.
  const purgeCalls = () =>
    prisma.user.update.mock.calls.filter(
      (c) => c[0]?.data && 'invitationCollabTokenPending' in c[0].data,
    );

  describe('registerOrganisateur', () => {
    const registerDto = (over: Record<string, unknown> = {}) => ({
      prenom: 'Anne',
      nom: 'Martin',
      email: 'anne@ecole.fr',
      password: PASSWORD,
      ...over,
    });

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null); // email libre
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        prenom: 'Anne',
        nom: 'Martin',
        email: 'anne@ecole.fr',
        role: 'ORGANISATEUR',
      });
    });

    it('écrit invitationCollabTokenPending quand le dto porte invitationCollabToken', async () => {
      await service.registerOrganisateur(
        registerDto({ invitationCollabToken: 'tok-invit-1' }) as any,
      );
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ invitationCollabTokenPending: 'tok-invit-1' }),
        }),
      );
    });

    it('écrit null quand le dto ne porte pas invitationCollabToken', async () => {
      await service.registerOrganisateur(registerDto() as any);
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ invitationCollabTokenPending: null }),
        }),
      );
    });
  });

  describe('verifyEmail', () => {
    beforeEach(() => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        role: 'ORGANISATEUR',
        compteValide: true,
        emailVerifie: false,
        tokenVerificationExpires: null,
        accompagnateurTokenPending: null,
      });
    });

    it('pending non-null → accepter appelé avec (token, {id}) puis purge', async () => {
      prisma.user.findUnique.mockResolvedValue({ invitationCollabTokenPending: 'tok-invit-1' });

      await service.verifyEmail('token-verif');

      expect(invitationCollab.accepter).toHaveBeenCalledWith('tok-invit-1', { id: 'user-1' });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { invitationCollabTokenPending: null },
      });
    });

    it('accepter throw ConflictException (état terminal) → purge quand même', async () => {
      prisma.user.findUnique.mockResolvedValue({ invitationCollabTokenPending: 'tok-invit-1' });
      invitationCollab.accepter.mockRejectedValue(new ConflictException('déjà acceptée'));

      await service.verifyEmail('token-verif');

      expect(purgeCalls()).toHaveLength(1);
    });

    it('accepter throw Error générique (transitoire) → PAS de purge, filet login rejouera', async () => {
      prisma.user.findUnique.mockResolvedValue({ invitationCollabTokenPending: 'tok-invit-1' });
      invitationCollab.accepter.mockRejectedValue(new Error('DB down'));

      await service.verifyEmail('token-verif');

      expect(purgeCalls()).toHaveLength(0);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('login (filet rejouable)', () => {
    const login = () => service.login({ email: 'heb@centre.fr', password: PASSWORD } as any);

    it('organisateur avec pending → accepter appelé', async () => {
      prisma.user.findUnique.mockResolvedValue(
        hebergeur({ role: 'ORGANISATEUR', invitationCollabTokenPending: 'tok-invit-1' }),
      );

      await login();

      expect(invitationCollab.accepter).toHaveBeenCalledWith('tok-invit-1', { id: 'user-1' });
    });

    it('hébergeur → accepter PAS appelé (filet réservé au rôle ORGANISATEUR)', async () => {
      prisma.user.findUnique.mockResolvedValue(
        hebergeur({ invitationCollabTokenPending: 'tok-invit-1' }),
      );

      await login();

      expect(invitationCollab.accepter).not.toHaveBeenCalled();
    });
  });
});
