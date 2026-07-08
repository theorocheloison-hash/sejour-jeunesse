import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import { CronAlertesService } from './cron-alertes.service';

function mockPrisma() {
  return {
    centreHebergement: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

const NOW = new Date('2026-07-07T08:00:00.000Z');
const dansJours = (j: number) => new Date(NOW.getTime() + j * 86400000);

function centreEssai(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'centre-1',
    nom: 'Centre Essai',
    abonnementActifJusquAu: dansJours(21),
    dernierEmailAlerteAt: null,
    planAbonnement: 'PILOTAGE',
    user: { email: 'heb@centre.fr', prenom: 'Jean', nom: 'Dupont' },
    ...over,
  };
}

describe('CronAlertesService', () => {
  let prisma: PrismaMock;
  let emailService: { sendTrialExpirationAlert: jest.Mock; sendGenericNotification: jest.Mock };
  let service: CronAlertesService;
  const envInitial = process.env.ENABLE_CRON;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['queueMicrotask'] });
    prisma = mockPrisma();
    emailService = {
      sendTrialExpirationAlert: jest.fn().mockResolvedValue(undefined),
      sendGenericNotification: jest.fn().mockResolvedValue(undefined),
    };
    service = new CronAlertesService(
      prisma as unknown as PrismaService,
      emailService as unknown as EmailService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    if (envInitial === undefined) delete process.env.ENABLE_CRON;
    else process.env.ENABLE_CRON = envInitial;
  });

  // ── Garde ENABLE_CRON ─────────────────────────────────────────────────

  describe('cronQuotidien — garde ENABLE_CRON', () => {
    it.each([
      ['absente', undefined],
      ['false', 'false'],
      ['TRUE (sensible à la casse)', 'TRUE'],
      ['1', '1'],
    ])('ENABLE_CRON %s → return immédiat, aucune requête ni email', async (_label, valeur) => {
      if (valeur === undefined) delete process.env.ENABLE_CRON;
      else process.env.ENABLE_CRON = valeur;

      await service.cronQuotidien();

      expect(prisma.centreHebergement.findMany).not.toHaveBeenCalled();
      expect(emailService.sendTrialExpirationAlert).not.toHaveBeenCalled();
      expect(emailService.sendGenericNotification).not.toHaveBeenCalled();
    });

    it("ENABLE_CRON === 'true' → les trois étapes s'exécutent", async () => {
      process.env.ENABLE_CRON = 'true';
      const alertes = jest.spyOn(service, 'envoyerAlertes');
      const expires = jest.spyOn(service, 'envoyerAlertesExpires');
      const renouv = jest.spyOn(service, 'envoyerAlertesRenouvellement');

      await service.cronQuotidien();

      expect(alertes).toHaveBeenCalledTimes(1);
      expect(expires).toHaveBeenCalledTimes(1);
      expect(renouv).toHaveBeenCalledTimes(1);
    });

    it("l'échec d'une étape n'empêche pas les suivantes", async () => {
      process.env.ENABLE_CRON = 'true';
      jest.spyOn(service, 'envoyerAlertes').mockRejectedValue(new Error('boom'));
      const expires = jest.spyOn(service, 'envoyerAlertesExpires');
      const renouv = jest.spyOn(service, 'envoyerAlertesRenouvellement');

      await expect(service.cronQuotidien()).resolves.toBeUndefined();

      expect(expires).toHaveBeenCalledTimes(1);
      expect(renouv).toHaveBeenCalledTimes(1);
    });
  });

  // ── envoyerAlertes : ciblage essais uniquement ────────────────────────

  describe('envoyerAlertes — filtres essais uniquement', () => {
    it('le WHERE cible les ESSAIS actifs : trial démarré, PAS de mandat Mollie, statut ACTIF', async () => {
      await service.envoyerAlertes();

      const arg = prisma.centreHebergement.findMany.mock.calls[0][0];
      expect(arg.where.abonnementStatut).toBe('ACTIF');
      expect(arg.where.trialStartedAt).toEqual({ not: null }); // essai consommé
      expect(arg.where.mollieMandatId).toBeNull(); // jamais un abonnement payé
      // Fenêtre J..J+21 et anti-spam 6 jours.
      expect(arg.where.abonnementActifJusquAu).toMatchObject({
        gte: expect.any(Date),
        lte: expect.any(Date),
      });
      expect(arg.where.OR).toEqual([
        { dernierEmailAlerteAt: null },
        { dernierEmailAlerteAt: { lt: expect.any(Date) } },
      ]);
    });

    it.each([21, 14, 7, 3, 1])('J-%i → alerte envoyée avec le bon nombre de jours', async (j) => {
      prisma.centreHebergement.findMany.mockResolvedValue([
        centreEssai({ abonnementActifJusquAu: dansJours(j) }),
      ]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(1);
      expect(emailService.sendTrialExpirationAlert).toHaveBeenCalledWith(
        'Centre Essai',
        'heb@centre.fr',
        'Jean',
        j,
        dansJours(j),
      );
      // Le tampon anti-spam est posé après envoi.
      expect(prisma.centreHebergement.update).toHaveBeenCalledWith({
        where: { id: 'centre-1' },
        data: { dernierEmailAlerteAt: expect.any(Date) },
      });
    });

    it.each([20, 10, 5, 2])('J-%i hors des paliers 21/14/7/3/1 → aucun envoi', async (j) => {
      prisma.centreHebergement.findMany.mockResolvedValue([
        centreEssai({ abonnementActifJusquAu: dansJours(j) }),
      ]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(0);
      expect(emailService.sendTrialExpirationAlert).not.toHaveBeenCalled();
      expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
    });

    it('centre sans email utilisateur ou sans date → ignoré sans erreur', async () => {
      prisma.centreHebergement.findMany.mockResolvedValue([
        centreEssai({ user: { email: null, prenom: 'X', nom: 'Y' } }),
        centreEssai({ id: 'centre-2', abonnementActifJusquAu: null }),
      ]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(0);
      expect(emailService.sendTrialExpirationAlert).not.toHaveBeenCalled();
    });

    it("échec d'envoi sur un centre → pas de tampon pour lui, les suivants continuent", async () => {
      prisma.centreHebergement.findMany.mockResolvedValue([
        centreEssai({ id: 'centre-ko' }),
        centreEssai({ id: 'centre-ok', nom: 'Centre OK' }),
      ]);
      emailService.sendTrialExpirationAlert
        .mockRejectedValueOnce(new Error('Brevo down'))
        .mockResolvedValueOnce(undefined);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(1);
      expect(prisma.centreHebergement.update).toHaveBeenCalledTimes(1);
      expect(prisma.centreHebergement.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'centre-ok' } }),
      );
    });

    it.todo(
      "centre payant par virement (trialStartedAt résiduel, pas de mandat Mollie) → PAS d'alerte essai — invariant du chantier 10.1, à faire passer avant le 26/09",
    );
  });

  // ── 10.1a : exclusion des clients payés par virement/BdC ─────────────

  describe('exclusion des clients virement (10.1a)', () => {
    /**
     * Le filtre vit dans le WHERE Prisma : pour le tester, le mock findMany
     * rejoue la sémantique SQL du groupe AND/OR modePaiement produit par le
     * service — {modePaiement: null} matche NULL ; {modePaiement: {not:
     * 'VIREMENT'}} exclut les NULL (comme `mode_paiement <> 'VIREMENT'`).
     */
    const matchModePaiement = (where: any, centre: any): boolean =>
      (where.AND ?? []).every((groupe: any) =>
        (groupe.OR ?? []).some((cond: any) => {
          if (cond.modePaiement === null) return centre.modePaiement == null;
          if (cond.modePaiement?.not) {
            return centre.modePaiement != null && centre.modePaiement !== cond.modePaiement.not;
          }
          return false;
        }),
      );

    const setCentres = (liste: Record<string, unknown>[]) => {
      prisma.centreHebergement.findMany.mockImplementation(async ({ where }: any) =>
        liste.filter((c) => matchModePaiement(where, c)),
      );
    };

    it('le cas Choucas : ACTIF, trial posé, pas de mandat, VIREMENT, J-21 → NON alerté', async () => {
      setCentres([centreEssai({ modePaiement: 'VIREMENT' })]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(0);
      expect(emailService.sendTrialExpirationAlert).not.toHaveBeenCalled();
      expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
    });

    it('un vrai essai (modePaiement null), J-21 → alerté (anti-régression Alticlub/Pôle Montagne)', async () => {
      setCentres([centreEssai({ modePaiement: null })]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(1);
      expect(emailService.sendTrialExpirationAlert).toHaveBeenCalledTimes(1);
    });

    it('le WHERE porte le groupe AND null-safe (jamais un not:VIREMENT seul)', async () => {
      await service.envoyerAlertes();
      const arg = prisma.centreHebergement.findMany.mock.calls[0][0];
      expect(arg.where.AND).toEqual([
        { OR: [{ modePaiement: null }, { modePaiement: { not: 'VIREMENT' } }] },
      ]);
      // Le not seul n'existe nulle part au premier niveau (il exclurait les NULL).
      expect(arg.where.modePaiement).toBeUndefined();
    });

    it('envoyerAlertesExpires porte la même exclusion : VIREMENT expiré → non notifié', async () => {
      setCentres([
        centreEssai({ modePaiement: 'VIREMENT', abonnementActifJusquAu: dansJours(-3) }),
      ]);

      const { expiresNotifies } = await service.envoyerAlertesExpires();

      expect(expiresNotifies).toBe(0);
      expect(emailService.sendTrialExpirationAlert).not.toHaveBeenCalled();
      const arg = prisma.centreHebergement.findMany.mock.calls[0][0];
      expect(arg.where.AND).toEqual([
        { OR: [{ modePaiement: null }, { modePaiement: { not: 'VIREMENT' } }] },
      ]);
    });
  });

  describe('envoyerAlertesRenouvellement', () => {
    it.todo(
      'le montant de renouvellement inclut le supplément multi-centre +39€/centre (bug 10.5, actuellement ignoré)',
    );
  });
});
