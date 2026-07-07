import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import type { ClaimService } from '../organisations/claim.service';
import { AuthService } from './auth.service';

/**
 * Tests du trial 30j Pilotage à la première connexion (activerTrialPremiereConnexion,
 * privé — exercé via login()). Les trois gardes (trialStartedAt, mollieMandatId,
 * abonnementStatut) vivent dans le WHERE du updateMany : le test unitaire vérifie
 * la clause exacte envoyée à Prisma + le court-circuit count=0, la base réelle
 * n'étant pas accessible ici.
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

  it('HEBERGEUR vierge : updateMany porte les TROIS gardes dans le WHERE', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    await login();

    expect(prisma.centreHebergement.updateMany).toHaveBeenCalledTimes(1);
    const arg = prisma.centreHebergement.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({
      userId: 'user-1',
      trialStartedAt: null, // garde 1 : trial jamais consommé
      mollieMandatId: null, // garde 2 : pas d'abonnement payé
      abonnementStatut: 'INACTIF', // garde 3 : ne touche jamais un centre ACTIF
    });
  });

  it('HEBERGEUR vierge : trial 30 jours PILOTAGE posé (plan, statut, expiration, trialStartedAt)', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.updateMany.mockResolvedValue({ count: 1 });
    prisma.centreHebergement.findMany.mockResolvedValue([{ nom: 'Centre A' }]);

    await login();

    const { data } = prisma.centreHebergement.updateMany.mock.calls[0][0];
    expect(data.planAbonnement).toBe('PILOTAGE');
    expect(data.abonnementStatut).toBe('ACTIF');
    expect(data.trialStartedAt).toBeInstanceOf(Date);
    expect(data.abonnementActifJusquAu).toBeInstanceOf(Date);
    const dureeMs = data.abonnementActifJusquAu.getTime() - data.trialStartedAt.getTime();
    // 30 jours calendaires (setDate +30) — tolérance 1h pour un éventuel passage DST.
    expect(Math.abs(dureeMs - 30 * 86400000)).toBeLessThanOrEqual(3600000);
  });

  it('centres activés (count > 0) → une notif admin par centre', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.updateMany.mockResolvedValue({ count: 2 });
    prisma.centreHebergement.findMany.mockResolvedValue([
      { nom: 'Centre A' },
      { nom: 'Centre B' },
    ]);

    await login();

    expect(email.sendNotifAdmin).toHaveBeenCalledTimes(2);
    expect(email.sendNotifAdmin.mock.calls[0][0]).toContain('Centre A');
    expect(email.sendNotifAdmin.mock.calls[1][0]).toContain('Centre B');
  });

  it('aucun centre éligible (count = 0) → ni lookup centres ni notif admin', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.updateMany.mockResolvedValue({ count: 0 });

    const result = await login();

    expect(result.access_token).toBe('jwt-token');
    expect(prisma.centreHebergement.findMany).not.toHaveBeenCalled();
    expect(email.sendNotifAdmin).not.toHaveBeenCalled();
  });

  it('échec de la notif admin → le login réussit quand même (non bloquant)', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    prisma.centreHebergement.updateMany.mockResolvedValue({ count: 1 });
    prisma.centreHebergement.findMany.mockResolvedValue([{ nom: 'Centre A' }]);
    email.sendNotifAdmin.mockRejectedValue(new Error('Brevo down'));

    const result = await login();

    expect(result.access_token).toBe('jwt-token');
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('échec du updateMany lui-même → le login réussit quand même', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
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
      expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
    },
  );

  it('login refusé (mauvais mot de passe) → jamais d’activation de trial', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur());
    await expect(
      service.login({ email: 'heb@centre.fr', password: 'mauvais' } as any),
    ).rejects.toThrow('Identifiants invalides');
    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
  });

  it('email non vérifié → EMAIL_NON_VERIFIE, jamais d’activation de trial', async () => {
    prisma.user.findUnique.mockResolvedValue(hebergeur({ emailVerifie: false }));
    await expect(login()).rejects.toThrow('EMAIL_NON_VERIFIE');
    expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
  });
});
