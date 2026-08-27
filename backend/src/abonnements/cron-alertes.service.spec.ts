import { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import { CronAlertesService } from './cron-alertes.service';

function mockPrisma() {
  return {
    organisation: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      // Lu par montantRecurrentOrganisationCents (point de calcul unique) pour le
      // mail de renouvellement — le where du cron a déjà filtré abonnement ANNUEL.
      findUnique: jest.fn().mockResolvedValue({ planAbonnement: 'PILOTAGE', abonnement: 'ANNUEL' }),
    },
    // centreHebergement.count : re-sollicité par le point de calcul unique (même
    // filtre ACTIVE + userId non null que l'include) ; update jamais touché (L3b).
    centreHebergement: {
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(1),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

const NOW = new Date('2026-07-07T08:00:00.000Z');
const dansJours = (j: number) => new Date(NOW.getTime() + j * 86400000);

const userJean = { email: 'heb@centre.fr', prenom: 'Jean', nom: 'Dupont' };

// L3b : le cron itère les ORGANISATIONS (une org = un abo) ; les centres
// exploités (ACTIVE + revendiqués) arrivent par l'include centresHebergement.
function orgEssai(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'org-1',
    abonnementActifJusquAu: dansJours(21),
    dernierEmailAlerteAt: null,
    planAbonnement: 'PILOTAGE',
    centresHebergement: [{ id: 'centre-1', nom: 'Centre Essai', user: userJean }],
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

      expect(prisma.organisation.findMany).not.toHaveBeenCalled();
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
    it('le WHERE cible les ESSAIS actifs sur l\'ORG : trial démarré, PAS de mandat Mollie, statut ACTIF', async () => {
      await service.envoyerAlertes();

      const arg = prisma.organisation.findMany.mock.calls[0][0];
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
      // Q7 : seuls les centres exploités (ACTIVE + revendiqués) sont inclus.
      expect(arg.include.centresHebergement.where).toEqual({
        statut: 'ACTIVE',
        userId: { not: null },
      });
    });

    it.each([21, 14, 7, 3, 1])('J-%i → alerte envoyée avec le bon nombre de jours', async (j) => {
      prisma.organisation.findMany.mockResolvedValue([
        orgEssai({ abonnementActifJusquAu: dansJours(j) }),
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
      // Le tampon anti-spam est posé sur l'ORG SEULE après envoi.
      expect(prisma.organisation.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { dernierEmailAlerteAt: expect.any(Date) },
      });
      expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
    });

    it.each([20, 10, 5, 2])('J-%i hors des paliers 21/14/7/3/1 → aucun envoi', async (j) => {
      prisma.organisation.findMany.mockResolvedValue([
        orgEssai({ abonnementActifJusquAu: dansJours(j) }),
      ]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(0);
      expect(emailService.sendTrialExpirationAlert).not.toHaveBeenCalled();
      expect(prisma.organisation.update).not.toHaveBeenCalled();
    });

    it('org sans email utilisateur ou sans date → ignorée sans erreur', async () => {
      prisma.organisation.findMany.mockResolvedValue([
        orgEssai({
          centresHebergement: [{ id: 'c1', nom: 'Centre Essai', user: { email: null, prenom: 'X', nom: 'Y' } }],
        }),
        orgEssai({ id: 'org-2', abonnementActifJusquAu: null }),
      ]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(0);
      expect(emailService.sendTrialExpirationAlert).not.toHaveBeenCalled();
    });

    it("échec d'envoi sur une org → pas de tampon pour elle, les suivantes continuent", async () => {
      prisma.organisation.findMany.mockResolvedValue([
        orgEssai({ id: 'org-ko' }),
        orgEssai({ id: 'org-ok', centresHebergement: [{ id: 'c-ok', nom: 'Centre OK', user: userJean }] }),
      ]);
      emailService.sendTrialExpirationAlert
        .mockRejectedValueOnce(new Error('Brevo down'))
        .mockResolvedValueOnce(undefined);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(1);
      expect(prisma.organisation.update).toHaveBeenCalledTimes(1);
      expect(prisma.organisation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org-ok' } }),
      );
    });

    it.todo(
      "centre payant par virement (trialStartedAt résiduel, pas de mandat Mollie) → PAS d'alerte essai — invariant du chantier 10.1, à faire passer avant le 26/09",
    );

    // ── L3b : une org = un abo = une itération (regroupement 4.20 supprimé) ──

    it("une org à 2 centres exploités → UN seul mail, noms joints, tampon posé sur l'org SEULE", async () => {
      prisma.organisation.findMany.mockResolvedValue([
        orgEssai({
          id: 'org-pm',
          centresHebergement: [
            { id: 'c-yaka', nom: 'YAKA', user: userJean },
            { id: 'c-flo', nom: 'Florimont', user: userJean },
          ],
        }),
      ]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(1);
      expect(emailService.sendTrialExpirationAlert).toHaveBeenCalledTimes(1);
      expect(emailService.sendTrialExpirationAlert).toHaveBeenCalledWith(
        'YAKA, Florimont', 'heb@centre.fr', 'Jean', 21, dansJours(21),
      );
      expect(prisma.organisation.update).toHaveBeenCalledTimes(1);
      expect(prisma.organisation.update).toHaveBeenCalledWith({
        where: { id: 'org-pm' },
        data: { dernierEmailAlerteAt: expect.any(Date) },
      });
      expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
    });

    it('deux orgs à paliers différents (J-21 et J-7) → deux alertes indépendantes', async () => {
      prisma.organisation.findMany.mockResolvedValue([
        orgEssai({
          id: 'org-a',
          abonnementActifJusquAu: dansJours(21),
          centresHebergement: [{ id: 'c-a', nom: 'Centre A', user: userJean }],
        }),
        orgEssai({
          id: 'org-b',
          abonnementActifJusquAu: dansJours(7),
          centresHebergement: [{ id: 'c-b', nom: 'Centre B', user: userJean }],
        }),
      ]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(2);
      expect(emailService.sendTrialExpirationAlert).toHaveBeenCalledTimes(2);
      expect(emailService.sendTrialExpirationAlert).toHaveBeenNthCalledWith(
        1, 'Centre A', 'heb@centre.fr', 'Jean', 21, dansJours(21),
      );
      expect(emailService.sendTrialExpirationAlert).toHaveBeenNthCalledWith(
        2, 'Centre B', 'heb@centre.fr', 'Jean', 7, dansJours(7),
      );
      expect(prisma.organisation.update).toHaveBeenCalledTimes(2);
    });

    it('org sans centre exploité → aucun mail, aucun tampon', async () => {
      prisma.organisation.findMany.mockResolvedValue([orgEssai({ centresHebergement: [] })]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(0);
      expect(emailService.sendTrialExpirationAlert).not.toHaveBeenCalled();
      expect(prisma.organisation.update).not.toHaveBeenCalled();
    });

    it('envoyerAlertesExpires : org à 2 centres expirée → un seul mail, noms joints, tampon org unique', async () => {
      prisma.organisation.findMany.mockResolvedValue([
        orgEssai({
          id: 'org-x',
          abonnementActifJusquAu: dansJours(-2),
          centresHebergement: [
            { id: 'c-a', nom: 'Centre A', user: userJean },
            { id: 'c-b', nom: 'Centre B', user: userJean },
          ],
        }),
      ]);

      const { expiresNotifies } = await service.envoyerAlertesExpires();

      expect(expiresNotifies).toBe(1);
      expect(emailService.sendTrialExpirationAlert).toHaveBeenCalledTimes(1);
      expect(emailService.sendTrialExpirationAlert).toHaveBeenCalledWith(
        'Centre A, Centre B', 'heb@centre.fr', 'Jean', 0, dansJours(-2),
      );
      expect(prisma.organisation.update).toHaveBeenCalledTimes(1);
      expect(prisma.organisation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org-x' } }),
      );
    });
  });

  // ── 10.1a : exclusion des clients payés par virement/BdC ─────────────

  describe('exclusion des clients virement (10.1a)', () => {
    /**
     * Le filtre vit dans le WHERE Prisma : pour le tester, le mock findMany
     * rejoue la sémantique SQL du groupe AND/OR modePaiement produit par le
     * service — {modePaiement: null} matche NULL ; {modePaiement: {not:
     * 'VIREMENT'}} exclut les NULL (comme `mode_paiement <> 'VIREMENT'`).
     */
    const matchModePaiement = (where: any, org: any): boolean =>
      (where.AND ?? []).every((groupe: any) =>
        (groupe.OR ?? []).some((cond: any) => {
          if (cond.modePaiement === null) return org.modePaiement == null;
          if (cond.modePaiement?.not) {
            return org.modePaiement != null && org.modePaiement !== cond.modePaiement.not;
          }
          return false;
        }),
      );

    const setOrgs = (liste: Record<string, unknown>[]) => {
      prisma.organisation.findMany.mockImplementation(async ({ where }: any) =>
        liste.filter((o) => matchModePaiement(where, o)),
      );
    };

    it('le cas Choucas : ACTIF, trial posé, pas de mandat, VIREMENT, J-21 → NON alerté', async () => {
      setOrgs([orgEssai({ modePaiement: 'VIREMENT' })]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(0);
      expect(emailService.sendTrialExpirationAlert).not.toHaveBeenCalled();
      expect(prisma.organisation.update).not.toHaveBeenCalled();
    });

    it('un vrai essai (modePaiement null), J-21 → alerté (anti-régression Alticlub/Pôle Montagne)', async () => {
      setOrgs([orgEssai({ modePaiement: null })]);

      const { alertesEnvoyees } = await service.envoyerAlertes();

      expect(alertesEnvoyees).toBe(1);
      expect(emailService.sendTrialExpirationAlert).toHaveBeenCalledTimes(1);
    });

    it('le WHERE porte le groupe AND null-safe (jamais un not:VIREMENT seul)', async () => {
      await service.envoyerAlertes();
      const arg = prisma.organisation.findMany.mock.calls[0][0];
      expect(arg.where.AND).toEqual([
        { OR: [{ modePaiement: null }, { modePaiement: { not: 'VIREMENT' } }] },
      ]);
      // Le not seul n'existe nulle part au premier niveau (il exclurait les NULL).
      expect(arg.where.modePaiement).toBeUndefined();
    });

    it('envoyerAlertesExpires porte la même exclusion : VIREMENT expiré → non notifié', async () => {
      setOrgs([
        orgEssai({ modePaiement: 'VIREMENT', abonnementActifJusquAu: dansJours(-3) }),
      ]);

      const { expiresNotifies } = await service.envoyerAlertesExpires();

      expect(expiresNotifies).toBe(0);
      expect(emailService.sendTrialExpirationAlert).not.toHaveBeenCalled();
      const arg = prisma.organisation.findMany.mock.calls[0][0];
      expect(arg.where.AND).toEqual([
        { OR: [{ modePaiement: null }, { modePaiement: { not: 'VIREMENT' } }] },
      ]);
    });
  });

  // ── D2 : fenêtre de relance post-expiration bornée à 15 jours ─────────

  describe('envoyerAlertesExpires — fenêtre de relance bornée 15j', () => {
    /**
     * Même approche que matchModePaiement : le filtre vit dans le WHERE
     * Prisma — le mock rejoue la sémantique de la fenêtre de dates
     * { lt, gte } sur abonnementActifJusquAu.
     */
    const matchFenetre = (where: any, org: any): boolean => {
      const exp = org.abonnementActifJusquAu as Date | null;
      const f = where.abonnementActifJusquAu ?? {};
      if (!exp) return false;
      if (f.lt && !(exp < f.lt)) return false;
      if (f.gte && !(exp >= f.gte)) return false;
      return true;
    };
    const setOrgs = (liste: Record<string, unknown>[]) => {
      prisma.organisation.findMany.mockImplementation(async ({ where }: any) =>
        liste.filter((o) => matchFenetre(where, o)),
      );
    };

    it('le WHERE borne la fenêtre : { lt: now, gte: now-15j } aux dates exactes', async () => {
      await service.envoyerAlertesExpires();

      const arg = prisma.organisation.findMany.mock.calls[0][0];
      expect(arg.where.abonnementActifJusquAu).toEqual({ lt: NOW, gte: dansJours(-15) });
    });

    it('org expirée depuis plus de 15 jours → aucun email, aucun tampon (silence définitif)', async () => {
      setOrgs([orgEssai({ abonnementActifJusquAu: dansJours(-16) })]);

      const { expiresNotifies } = await service.envoyerAlertesExpires();

      expect(expiresNotifies).toBe(0);
      expect(emailService.sendTrialExpirationAlert).not.toHaveBeenCalled();
      expect(prisma.organisation.update).not.toHaveBeenCalled();
    });

    it('org expirée depuis 2 jours (dans la fenêtre) → relancée (contrôle positif du mock)', async () => {
      setOrgs([orgEssai({ abonnementActifJusquAu: dansJours(-2) })]);

      const { expiresNotifies } = await service.envoyerAlertesExpires();

      expect(expiresNotifies).toBe(1);
      expect(emailService.sendTrialExpirationAlert).toHaveBeenCalledTimes(1);
    });
  });

  describe('envoyerAlertesRenouvellement', () => {
    it('org mono-centre PILOTAGE annuel → montant du plan seul (690 €)', async () => {
      prisma.organisation.findMany.mockResolvedValue([
        orgEssai({ abonnementActifJusquAu: dansJours(30) }),
      ]);

      const { renouvellementsNotifies } = await service.envoyerAlertesRenouvellement();

      expect(renouvellementsNotifies).toBe(1);
      const [, sujet, corps] = emailService.sendGenericNotification.mock.calls[0];
      expect(sujet).toBe('Renouvellement de votre abonnement LIAVO');
      expect(corps).toContain('690 €');
    });

    it("le montant inclut le supplément multi-centre +490 €/an/centre (10.5) : org à 2 centres exploités → 1180 €", async () => {
      prisma.organisation.findMany.mockResolvedValue([
        orgEssai({
          id: 'org-pm',
          abonnementActifJusquAu: dansJours(30),
          centresHebergement: [
            { id: 'c-yaka', nom: 'YAKA', user: userJean },
            { id: 'c-flo', nom: 'Florimont', user: userJean },
          ],
        }),
      ]);
      // Le point de calcul unique refait un count filtré (2 centres exploités ici).
      prisma.centreHebergement.count.mockResolvedValue(2);

      const { renouvellementsNotifies } = await service.envoyerAlertesRenouvellement();

      expect(renouvellementsNotifies).toBe(1);
      // Le montant passe par montantRecurrentOrganisationCents, qui compte les
      // centres exploités avec le MÊME filtre que l'include (ACTIVE + userId non null).
      expect(prisma.centreHebergement.count).toHaveBeenCalledWith({
        where: { organisationId: 'org-pm', statut: 'ACTIVE', userId: { not: null } },
      });
      const [, , corps] = emailService.sendGenericNotification.mock.calls[0];
      expect(corps).toContain('1180 €');
      expect(corps).not.toContain('690 €');
    });
  });

  // ── 10.1b-4 : relance admin J-30 pour les renouvellements virement ───

  describe('envoyerRelanceVirement', () => {
    it('org VIREMENT/ACTIF/J-30 → 1 relance admin + tampon dernierEmailAlerteAt posé sur l\'org', async () => {
      prisma.organisation.findMany.mockResolvedValue([
        orgEssai({ modePaiement: 'VIREMENT', abonnementActifJusquAu: dansJours(30) }),
      ]);

      const { relancesVirementNotifiees } = await service.envoyerRelanceVirement();

      expect(relancesVirementNotifiees).toBe(1);
      expect(emailService.sendGenericNotification).toHaveBeenCalledTimes(1);
      const [to, sujet, corps] = emailService.sendGenericNotification.mock.calls[0];
      expect(to).toBe('contact@liavo.fr');
      expect(sujet).toBe('Renouvellement virement à préparer');
      expect(corps).toContain('Centre Essai');
      expect(corps).toContain('PILOTAGE');
      expect(corps).toContain('ré-émettre la facture virement/BdC');
      expect(prisma.organisation.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { dernierEmailAlerteAt: expect.any(Date) },
      });
      expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
    });

    it('org VIREMENT sans centre exploité → aucun mail admin (pas de relance sans nom de centre)', async () => {
      prisma.organisation.findMany.mockResolvedValue([
        orgEssai({ modePaiement: 'VIREMENT', abonnementActifJusquAu: dansJours(30), centresHebergement: [] }),
      ]);

      const { relancesVirementNotifiees } = await service.envoyerRelanceVirement();

      expect(relancesVirementNotifiees).toBe(0);
      expect(emailService.sendGenericNotification).not.toHaveBeenCalled();
      expect(prisma.organisation.update).not.toHaveBeenCalled();
    });

    it('ciblage exclusif VIREMENT : les orgs Mollie ou en essai ne matchent pas le WHERE', async () => {
      await service.envoyerRelanceVirement();

      const arg = prisma.organisation.findMany.mock.calls[0][0];
      // Égalité stricte : une org Mollie ou un vrai essai a modePaiement null → exclue.
      expect(arg.where.modePaiement).toBe('VIREMENT');
      expect(arg.where.abonnementStatut).toBe('ACTIF');
      // Fenêtre J..J+30 + même debounce 25j que la relance renouvellement.
      expect(arg.where.abonnementActifJusquAu).toMatchObject({
        gte: expect.any(Date),
        lte: expect.any(Date),
      });
      expect(arg.where.OR).toEqual([
        { dernierEmailAlerteAt: null },
        { dernierEmailAlerteAt: { lt: expect.any(Date) } },
      ]);
    });

    it('aucune org ciblée (debounce ou fenêtre) → aucun email, aucun tampon', async () => {
      prisma.organisation.findMany.mockResolvedValue([]);

      const { relancesVirementNotifiees } = await service.envoyerRelanceVirement();

      expect(relancesVirementNotifiees).toBe(0);
      expect(emailService.sendGenericNotification).not.toHaveBeenCalled();
      expect(prisma.organisation.update).not.toHaveBeenCalled();
    });

    it("cronQuotidien exécute la relance virement en 4e étape, même si une étape précédente échoue", async () => {
      process.env.ENABLE_CRON = 'true';
      jest.spyOn(service, 'envoyerAlertes').mockRejectedValue(new Error('boom'));
      const relance = jest.spyOn(service, 'envoyerRelanceVirement');

      await service.cronQuotidien();

      expect(relance).toHaveBeenCalledTimes(1);
    });
  });
});
