import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import type { ClaimService } from '../organisations/claim.service';
import { AuthService } from './auth.service';

/**
 * Tests du trial à la première connexion, désormais délégué à la source unique
 * demarrerOuAlignerTrial (centres/trial.helper) — exercé ici via login().
 * Les gardes détaillées (compte payant, abonnement offert, centre PENDING,
 * alignement multi-centre) sont couvertes par trial.helper.spec.ts ; ce fichier
 * vérifie le câblage depuis login() : rôle HEBERGEUR uniquement, jamais avant
 * validation du mot de passe, et échec du helper non bloquant.
 */

const PASSWORD = 'S3cret!password';
// Coût bcrypt 4 (au lieu de 12) : le hash embarque son coût, compare() reste valide.
let PASSWORD_HASH: string;

function mockPrisma() {
  return {
    user: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    centreHebergement: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue([]),
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

/** Centre ACTIVE vierge : éligible au trial dans demarrerOuAlignerTrial. */
function centreVierge(over: Partial<Record<string, unknown>> = {}) {
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

describe('AuthService.login — trial première connexion', () => {
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
    );
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  const login = () => service.login({ email: 'heb@centre.fr', password: PASSWORD } as any);

  it("HEBERGEUR vierge : le helper charge les centres du user et borne l'updateMany aux éligibles", async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.findMany.mockResolvedValue([centreVierge()]);
    await login();

    expect(prisma.centreHebergement.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.centreHebergement.findMany.mock.calls[0][0].where).toEqual({ userId: 'user-1' });
    expect(prisma.centreHebergement.updateMany).toHaveBeenCalledTimes(1);
    const arg = prisma.centreHebergement.updateMany.mock.calls[0][0];
    // Garde de réentrance : seuls les éligibles capturés, jamais re-trialés.
    expect(arg.where).toEqual({ id: { in: ['centre-1'] }, trialStartedAt: null });
  });

  it('HEBERGEUR vierge : trial 30 jours PILOTAGE posé (plan, statut, expiration, trialStartedAt)', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.findMany.mockResolvedValue([centreVierge()]);
    prisma.centreHebergement.updateMany.mockResolvedValue({ count: 1 });

    await login();

    const { data } = prisma.centreHebergement.updateMany.mock.calls[0][0];
    expect(data.planAbonnement).toBe('PILOTAGE');
    expect(data.abonnementStatut).toBe('ACTIF');
    expect(data.trialStartedAt).toBeInstanceOf(Date);
    expect(data.abonnementActifJusquAu).toBeInstanceOf(Date);
    // trialExpiration() tronque à minuit UTC : durée réelle dans (29j, 30j].
    const dureeMs = data.abonnementActifJusquAu.getTime() - data.trialStartedAt.getTime();
    expect(dureeMs).toBeGreaterThan(29 * 86400000 - 3600000);
    expect(dureeMs).toBeLessThanOrEqual(30 * 86400000 + 3600000);
  });

  it('centres éligibles → une notif admin par centre', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.findMany.mockResolvedValue([
      centreVierge({ id: 'c-a', nom: 'Centre A' }),
      centreVierge({ id: 'c-b', nom: 'Centre B' }),
    ]);
    prisma.centreHebergement.updateMany.mockResolvedValue({ count: 2 });

    await login();

    expect(email.sendNotifAdmin).toHaveBeenCalledTimes(2);
    expect(email.sendNotifAdmin.mock.calls[0][0]).toContain('Centre A');
    expect(email.sendNotifAdmin.mock.calls[1][0]).toContain('Centre B');
  });

  it('aucun centre éligible → ni updateMany ni notif admin', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.findMany.mockResolvedValue([]);

    const result = await login();

    expect(result.access_token).toBe('jwt-token');
    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
    expect(email.sendNotifAdmin).not.toHaveBeenCalled();
  });

  it('échec de la notif admin → le login réussit quand même (non bloquant)', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.findMany.mockResolvedValue([centreVierge()]);
    prisma.centreHebergement.updateMany.mockResolvedValue({ count: 1 });
    email.sendNotifAdmin.mockRejectedValue(new Error('Brevo down'));

    const result = await login();

    expect(result.access_token).toBe('jwt-token');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('échec du updateMany lui-même → le login réussit quand même', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.findMany.mockResolvedValue([centreVierge()]);
    prisma.centreHebergement.updateMany.mockRejectedValue(new Error('DB down'));

    const result = await login();

    expect(result.access_token).toBe('jwt-token');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it.each(['ORGANISATEUR', 'ADMIN', 'PARENT', 'RESEAU'])(
    'rôle %s → aucune tentative d’activation de trial',
    async (role) => {
      prisma.user.findUnique.mockResolvedValue(hebergeur({ role, compteValide: false }));

      const result = await login();

      expect(result.access_token).toBe('jwt-token');
      expect(prisma.centreHebergement.findMany).not.toHaveBeenCalled();
      expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
    },
  );

  it('login refusé (mauvais mot de passe) → jamais d’activation de trial', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    await expect(
      service.login({ email: 'heb@centre.fr', password: 'mauvais' } as any),
    ).rejects.toThrow('Identifiants invalides');
    expect(prisma.centreHebergement.findMany).not.toHaveBeenCalled();
    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
  });

  it('email non vérifié → EMAIL_NON_VERIFIE, jamais d’activation de trial', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur({ emailVerifie: false }));
    await expect(login()).rejects.toThrow('EMAIL_NON_VERIFIE');
    expect(prisma.centreHebergement.findMany).not.toHaveBeenCalled();
    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
  });
});
