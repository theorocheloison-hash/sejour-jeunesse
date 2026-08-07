import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import type { EmailService } from '../email/email.service';
import { CentreService } from './centre.service';

/**
 * Tests de register() (invitation admin/réseau → compte hébergeur), Lot 2e-2 :
 * transaction tout-ou-rien, claimStatut VALIDE (invitation admin = pré-validée),
 * abonnement COMPLET offert sur l'ORGANISATION + miroir centre, invitation
 * consommée EN DERNIER, notif admin APRÈS le commit.
 * Les helpers organisation/membership sont les VRAIS (comme create-centre.spec) :
 * les assertions portent sur les délégués Prisma du tx mocké.
 */

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed-password') }));

const INVITATION = {
  id: 'inv-1',
  token: 'tok-1',
  email: 'heb@centre.fr',
  nomCentre: 'Chalet Précréé',
  utilisedAt: null,
  centreExistantId: null as string | null,
  centrePrecreerNom: 'Chalet Précréé',
  centrePrecreerAdresse: '1 route du Col',
  centrePrecreerVille: 'Vallorcine',
  centrePrecreerCodePostal: '74660',
  centrePrecreerCapacite: 40,
  centrePrecreerSiret: null as string | null,
  centrePrecreerDepartement: '74',
};

function mockTx() {
  return {
    user: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'user-new',
        prenom: data.prenom,
        nom: data.nom,
        email: data.email,
        role: data.role,
      })),
    },
    centreHebergement: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'centre-new',
        organisationId: null,
        ...data,
      })),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'centre-new',
        nom: 'Chalet Précréé',
        ...data,
      })),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    organisation: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'org-new', nom: 'Chalet Précréé' }),
      update: jest.fn().mockResolvedValue({}),
    },
    membership: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 'ms-new', ...data })),
    },
    invitationHebergement: {
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

type TxMock = ReturnType<typeof mockTx>;

describe('CentreService.register (Lot 2e-2 — transaction + abo org + claim VALIDE)', () => {
  let tx: TxMock;
  let prisma: {
    invitationHebergement: { findUnique: jest.Mock };
    centreHebergement: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let email: { notifyAdminNewAccount: jest.Mock };
  let jwt: { sign: jest.Mock };
  let service: CentreService;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    tx = mockTx();
    prisma = {
      invitationHebergement: { findUnique: jest.fn().mockResolvedValue({ ...INVITATION }) },
      centreHebergement: { findUnique: jest.fn().mockResolvedValue(null) },
      user: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn().mockResolvedValue({}) },
      $transaction: jest.fn(async (cb: (tx: TxMock) => Promise<unknown>) => cb(tx)),
    };
    email = { notifyAdminNewAccount: jest.fn().mockResolvedValue(undefined) };
    jwt = { sign: jest.fn().mockReturnValue('jwt-token') };
    service = new CentreService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      {} as StorageService,
      email as unknown as EmailService,
    );
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const register = () => service.register({ token: 'tok-1', password: 'S3cret!password' } as any);

  it('CAS 2 nominal : user + centre + org + membership créés, abo posé, réponse complète', async () => {
    const res = await register();

    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(tx.centreHebergement.create).toHaveBeenCalledTimes(1);
    expect(tx.organisation.create).toHaveBeenCalledTimes(1); // org neuve (organisationId null)
    expect(tx.membership.create).toHaveBeenCalledTimes(1);
    expect(res.access_token).toBe('jwt-token');
    expect(res.user).toMatchObject({ id: 'user-new', email: 'heb@centre.fr' });
  });

  it('membership créé avec claimStatut VALIDE + claimValidatedAt (pré-validation admin), claimValidatedById null', async () => {
    await register();

    const data = tx.membership.create.mock.calls[0][0].data;
    expect(data.claimStatut).toBe('VALIDE');
    expect(data.claimValidatedAt).toBeInstanceOf(Date);
    expect(data.claimValidatedById).toBeNull();
    expect(data.role).toBe('PROPRIETAIRE');
    expect(data.isPrimary).toBe(true);
  });

  it('abo COMPLET offert sur l ORG et le MIROIR centre, mêmes valeurs', async () => {
    await register();

    const orgData = tx.organisation.update.mock.calls[0][0].data;
    expect(orgData).toMatchObject({ planAbonnement: 'COMPLET', abonnementStatut: 'ACTIF' });
    expect(orgData.abonnementActifJusquAu).toBeInstanceOf(Date);

    // Le miroir centre = le dernier update centre (après celui qui pose organisationId).
    const centreAboCall = tx.centreHebergement.update.mock.calls.find(
      (c) => c[0].data.planAbonnement === 'COMPLET',
    );
    expect(centreAboCall).toBeDefined();
    expect(centreAboCall![0].data).toMatchObject({ planAbonnement: 'COMPLET', abonnementStatut: 'ACTIF' });
    expect(centreAboCall![0].data.abonnementActifJusquAu).toEqual(orgData.abonnementActifJusquAu);
    // Sémantique « offert » : jamais de trialStartedAt.
    expect(centreAboCall![0].data.trialStartedAt).toBeUndefined();
  });

  it('invitation.utilisedAt = DERNIER write de la transaction', async () => {
    await register();

    const invOrder = tx.invitationHebergement.update.mock.invocationCallOrder[0];
    expect(invOrder).toBeGreaterThan(tx.organisation.update.mock.invocationCallOrder[0]);
    expect(invOrder).toBeGreaterThan(tx.membership.create.mock.invocationCallOrder[0]);
    const dernierUpdateCentre = Math.max(...tx.centreHebergement.update.mock.invocationCallOrder);
    expect(invOrder).toBeGreaterThan(dernierUpdateCentre);
  });

  it('notifyAdminNewAccount appelée APRÈS le commit (après le dernier write de la tx)', async () => {
    await register();

    expect(email.notifyAdminNewAccount).toHaveBeenCalledTimes(1);
    const notifOrder = email.notifyAdminNewAccount.mock.invocationCallOrder[0];
    expect(notifOrder).toBeGreaterThan(tx.invitationHebergement.update.mock.invocationCallOrder[0]);
  });

  it('rollback : un write échoue à mi-course → aucune notif, aucun JWT, invitation non consommée', async () => {
    tx.organisation.update.mockRejectedValue(new Error('DB down'));

    await expect(register()).rejects.toThrow('DB down');

    // La transaction n'a pas atteint la consommation de l'invitation…
    expect(tx.invitationHebergement.update).not.toHaveBeenCalled();
    // …ni les étapes post-commit (notif, JWT, refresh token).
    expect(email.notifyAdminNewAccount).not.toHaveBeenCalled();
    expect(jwt.sign).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('invitation déjà utilisée → ConflictException, aucune transaction ouverte', async () => {
    prisma.invitationHebergement.findUnique.mockResolvedValue({ ...INVITATION, utilisedAt: new Date() });

    await expect(register()).rejects.toThrow('déjà été utilisée');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
