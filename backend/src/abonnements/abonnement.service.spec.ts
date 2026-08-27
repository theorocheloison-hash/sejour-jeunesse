import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { AbonnementService } from './abonnement.service';
import { getCentreForUser } from '../centres/centre.helper';
import { TRIAL_EXTENSION_JOURS } from '../centres/trial.helper';
import { mollieClient } from './mollie.client';
import { resyncMontantOrganisation } from './resync-montant.helper';

/**
 * Tests des Lots 2a + L3c : l'état d'abonnement est porté par l'ORGANISATION
 * seule (résolue via le centre actif) — plus aucune double écriture, les
 * colonnes abo de CentreHebergement ne sont jamais écrites.
 * Mocks littéraux (patron trial.helper.spec) ; le singleton Mollie, le helper
 * resync et getCentreForUser sont mockés au niveau module.
 */

jest.mock('../centres/centre.helper', () => ({ getCentreForUser: jest.fn() }));
// Le vrai FactureLiavoService tire la chaîne react-pdf (facture-pdf.generator) —
// même parade que refuser-centre.spec : classe vide, l'instance est un mock littéral.
jest.mock('../facture-liavo/facture-liavo.service', () => ({ FactureLiavoService: class {} }));
jest.mock('@mollie/api-client', () => ({ MandateMethod: { directdebit: 'directdebit' } }));
jest.mock('./mollie.client', () => ({
  mollieClient: {
    payments: { get: jest.fn() },
    customers: { create: jest.fn() },
    customerMandates: { create: jest.fn() },
    customerSubscriptions: { create: jest.fn(), cancel: jest.fn(), update: jest.fn() },
  },
}));
jest.mock('./resync-montant.helper', () => ({
  resyncMontantOrganisation: jest.fn().mockResolvedValue(undefined),
}));

const USER_ID = 'user-1';
const CENTRE = { id: 'c-1', nom: 'Chalet A', organisationId: 'org-1' };

function orgVierge(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'org-1',
    nom: 'Pole Test',
    raisonSociale: null,
    mollieCustomerId: null,
    mollieSubscriptionId: null,
    mollieMandatId: null,
    planAbonnement: 'DECOUVERTE',
    abonnement: null,
    abonnementStatut: 'INACTIF',
    abonnementActifJusquAu: null,
    trialStartedAt: null,
    ...over,
  };
}

function mockPrisma() {
  return {
    organisation: {
      findUnique: jest.fn().mockResolvedValue(orgVierge()),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    centreHebergement: {
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findFirst: jest.fn().mockResolvedValue({ id: 'c-repr' }),
    },
    membership: {
      findUnique: jest.fn().mockResolvedValue({ role: 'PROPRIETAIRE' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'heb@test.fr', prenom: 'Jean', nom: 'Dupont' }),
    },
    acceptationCgv: { create: jest.fn().mockResolvedValue({}) },
    factureLiavo: { findFirst: jest.fn().mockResolvedValue(null) },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

const mockedGetCentre = getCentreForUser as jest.Mock;
const mockedMollie = mollieClient as unknown as {
  payments: { get: jest.Mock };
  customers: { create: jest.Mock };
  customerMandates: { create: jest.Mock };
  customerSubscriptions: { create: jest.Mock; cancel: jest.Mock };
};
const mockedResync = resyncMontantOrganisation as jest.Mock;

describe('AbonnementService (Lot 2a — abonnement porté par l organisation)', () => {
  let prisma: PrismaMock;
  let factureLiavo: { emettre: jest.Mock; listerParOrganisation: jest.Mock };
  let email: {
    sendConfirmationAbonnement: jest.Mock;
    sendNotifAdmin: jest.Mock;
    sendConfirmationAnnulation: jest.Mock;
  };
  let service: AbonnementService;

  const souscrire = () =>
    service.souscrire(USER_ID, 'PILOTAGE', 'MENSUEL', 'FR76 3000 6000 0112 3456 7890 189', 'Jean Dupont', undefined, true, '1.2.3.4');

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mockPrisma();
    factureLiavo = { emettre: jest.fn().mockResolvedValue({}), listerParOrganisation: jest.fn().mockResolvedValue([]) };
    email = {
      sendConfirmationAbonnement: jest.fn().mockResolvedValue(undefined),
      sendNotifAdmin: jest.fn().mockResolvedValue(undefined),
      sendConfirmationAnnulation: jest.fn().mockResolvedValue(undefined),
    };
    service = new AbonnementService(
      prisma as unknown as PrismaService,
      factureLiavo as never,
      email as never,
    );
    mockedGetCentre.mockResolvedValue(CENTRE);
    mockedMollie.customers.create.mockResolvedValue({ id: 'cst_new' });
    mockedMollie.customerMandates.create.mockResolvedValue({ id: 'mdt_new' });
    mockedMollie.customerSubscriptions.create.mockResolvedValue({ id: 'sub_new' });
    mockedMollie.customerSubscriptions.cancel.mockResolvedValue({});
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('souscrire — garde PROPRIETAIRE + résolution org', () => {
    it('collaborateur sans membership → 403', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(souscrire()).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.organisation.update).not.toHaveBeenCalled();
    });

    it('membership MEMBRE (pas PROPRIETAIRE) → 403', async () => {
      prisma.membership.findUnique.mockResolvedValue({ role: 'MEMBRE' });
      await expect(souscrire()).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('centre sans organisationId → 409', async () => {
      mockedGetCentre.mockResolvedValue({ ...CENTRE, organisationId: null });
      await expect(souscrire()).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('souscrire — PROPRIETAIRE, chemin nominal', () => {
    it('comptage = centres ACTIVE de l org avec userId non null (exclusion catalogue)', async () => {
      await souscrire();
      expect(prisma.centreHebergement.count).toHaveBeenCalledWith({
        where: { organisationId: 'org-1', statut: 'ACTIVE', userId: { not: null } },
      });
    });

    it('écrit mollie*/plan/statut sur l ORG seule (L3c)', async () => {
      await souscrire();
      const attendu = expect.objectContaining({
        mollieCustomerId: 'cst_new',
        mollieMandatId: 'mdt_new',
        mollieSubscriptionId: 'sub_new',
        planAbonnement: 'PILOTAGE',
        abonnement: 'MENSUEL',
        abonnementStatut: 'ACTIF',
      });
      expect(prisma.organisation.update).toHaveBeenCalledWith({ where: { id: 'org-1' }, data: attendu });
      expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
    });

    it('customer Mollie nommé raisonSociale ?? nom, subscription décrite par l org, montant avec supplément', async () => {
      prisma.centreHebergement.count.mockResolvedValue(2); // 6900 + 4900 = 11800
      await souscrire();
      expect(mockedMollie.customers.create).toHaveBeenCalledWith({ name: 'Pole Test', email: 'heb@test.fr' });
      expect(mockedMollie.customerSubscriptions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: { value: '118.00', currency: 'EUR' },
          description: expect.stringContaining('— Pole Test'),
        }),
      );
    });

    it('annule l ancienne subscription DE L ORG (garde anti-double-souscription) + reset org seule (L3c)', async () => {
      prisma.organisation.findUnique.mockResolvedValue(
        orgVierge({ mollieSubscriptionId: 'sub_old', mollieCustomerId: 'cst_old' }),
      );
      await souscrire();
      expect(mockedMollie.customerSubscriptions.cancel).toHaveBeenCalledWith('sub_old', { customerId: 'cst_old' });
      expect(prisma.organisation.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { mollieSubscriptionId: null },
      });
      expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
    });

    it('AcceptationCgv porte organisationId ET centreId (trace)', async () => {
      await souscrire();
      expect(prisma.acceptationCgv.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ centreId: 'c-1', organisationId: 'org-1', plan: 'PILOTAGE' }),
      });
    });
  });

  describe('souscrire — Porte 2 : Essentiel refusé si ≥2 centres actifs', () => {
    const souscrireEssentiel = () =>
      service.souscrire(USER_ID, 'ESSENTIEL', 'MENSUEL', 'FR76 3000 6000 0112 3456 7890 189', 'Jean Dupont', undefined, true, '1.2.3.4');

    it('ESSENTIEL avec 2 centres actifs → 400 AVANT toute mutation Mollie (cancel jamais appelé)', async () => {
      // Org AVEC subscription existante : sans le fix d'ordre, le downgrade refusé
      // annulerait le mandat avant le throw. On prouve que la porte 2 rejette AVANT
      // le bloc cancel — ni annulation Mollie, ni reset mollieSubscriptionId.
      prisma.organisation.findUnique.mockResolvedValue(
        orgVierge({
          mollieSubscriptionId: 'sub_old',
          mollieCustomerId: 'cst_old',
          planAbonnement: 'PILOTAGE',
          abonnement: 'MENSUEL',
          abonnementStatut: 'ACTIF',
        }),
      );
      prisma.centreHebergement.count.mockResolvedValue(2);

      await expect(souscrireEssentiel()).rejects.toBeInstanceOf(BadRequestException);

      expect(mockedMollie.customerSubscriptions.cancel).not.toHaveBeenCalled();
      expect(prisma.organisation.update).not.toHaveBeenCalled();
      expect(mockedMollie.customerSubscriptions.create).not.toHaveBeenCalled();
    });

    it('ESSENTIEL avec 1 seul centre → autorisé (la porte ne bloque pas)', async () => {
      prisma.centreHebergement.count.mockResolvedValue(1);
      await souscrireEssentiel();
      expect(prisma.organisation.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ planAbonnement: 'ESSENTIEL' }) }),
      );
    });
  });

  describe('handleWebhook — résolution org, facture au montant prélevé, resync', () => {
    const orgAbonnee = () =>
      orgVierge({
        mollieCustomerId: 'cst_1',
        mollieSubscriptionId: 'sub_1',
        mollieMandatId: 'mdt_1',
        planAbonnement: 'PILOTAGE',
        abonnement: 'MENSUEL',
        abonnementStatut: 'ACTIF',
      });

    beforeEach(() => {
      mockedMollie.payments.get.mockResolvedValue({
        status: 'paid',
        sequenceType: 'recurring',
        customerId: 'cst_1',
        amount: { currency: 'EUR', value: '147.00' },
      });
      prisma.organisation.findFirst.mockResolvedValue(orgAbonnee());
      // Le fallback recalcul passe par montantRecurrentOrganisationCents, qui
      // relit l'org via findUnique (par id) : même ligne que findFirst en prod.
      prisma.organisation.findUnique.mockResolvedValue(orgAbonnee());
    });

    it('résout l ORGANISATION par mollieCustomerId', async () => {
      await service.handleWebhook('tr_1');
      expect(prisma.organisation.findFirst).toHaveBeenCalledWith({ where: { mollieCustomerId: 'cst_1' } });
    });

    it('prolonge l org seule (L3c)', async () => {
      await service.handleWebhook('tr_1');
      expect(prisma.organisation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org-1' } }),
      );
      // NB : findFirst (centre représentatif facture) et count restent appelés.
      expect(prisma.centreHebergement.updateMany).not.toHaveBeenCalled();
    });

    it('facture le montant RÉELLEMENT prélevé ("147.00" → 14700 cts) via emettre(centre repr., …, organisationId)', async () => {
      await service.handleWebhook('tr_1');
      expect(factureLiavo.emettre).toHaveBeenCalledWith(
        'c-repr', 14700, 'PILOTAGE', 'MENSUEL', 'tr_1', null, 'org-1',
      );
    });

    it('payment.amount absent → fallback recalcul théorique (jamais de facture à 0)', async () => {
      mockedMollie.payments.get.mockResolvedValue({
        status: 'paid', sequenceType: 'recurring', customerId: 'cst_1', amount: undefined,
      });
      prisma.centreHebergement.count.mockResolvedValue(2); // 6900 + 4900 = 11800
      await service.handleWebhook('tr_1');
      expect(factureLiavo.emettre).toHaveBeenCalledWith(
        'c-repr', 11800, 'PILOTAGE', 'MENSUEL', 'tr_1', null, 'org-1',
      );
    });

    it('appelle resyncMontantOrganisation en dernier geste', async () => {
      await service.handleWebhook('tr_1');
      expect(mockedResync).toHaveBeenCalledWith(expect.anything(), expect.anything(), 'org-1');
    });

    it('idempotence molliePaymentId : facture existante → skip, ni emettre ni resync', async () => {
      prisma.factureLiavo.findFirst.mockResolvedValue({ numero: 'FL-2026-001' });
      const res = await service.handleWebhook('tr_1');
      expect(res).toMatchObject({ alreadyProcessed: true });
      expect(factureLiavo.emettre).not.toHaveBeenCalled();
      expect(mockedResync).not.toHaveBeenCalled();
    });

    it('organisation introuvable pour le customer → réponse 200 sans écriture', async () => {
      prisma.organisation.findFirst.mockResolvedValue(null);
      const res = await service.handleWebhook('tr_1');
      expect(res).toEqual({ received: true });
      expect(prisma.organisation.update).not.toHaveBeenCalled();
    });
  });

  describe('demanderExtension — extension unique de TRIAL_EXTENSION_JOURS', () => {
    it('extension autorisée sur essai frais : nouvelle fin = fin actuelle + TRIAL_EXTENSION_JOURS', async () => {
      // Essai frais : démarré il y a 10j, fin à trialStart+30j (dans 20j, future).
      const trialStart = new Date(); trialStart.setDate(trialStart.getDate() - 10);
      const finActuelle = new Date(trialStart); finActuelle.setDate(finActuelle.getDate() + 30);
      prisma.organisation.findUnique.mockResolvedValue(
        orgVierge({
          trialStartedAt: trialStart,
          abonnementActifJusquAu: finActuelle,
          planAbonnement: 'PILOTAGE',
          abonnementStatut: 'ACTIF',
        }),
      );

      const res = await service.demanderExtension(USER_ID, 'c-1');

      const attendu = new Date(finActuelle); attendu.setDate(attendu.getDate() + TRIAL_EXTENSION_JOURS);
      expect(prisma.organisation.update).toHaveBeenCalledWith({
        where: { id: 'org-1' },
        data: { abonnementActifJusquAu: attendu, abonnementStatut: 'ACTIF' },
      });
      expect(res).toMatchObject({ success: true, actifJusquAu: attendu });
    });

    it('2e extension bloquée : fin déjà à trialStart+45j (> seuil 40j) → BadRequest, aucun update', async () => {
      const trialStart = new Date(); trialStart.setDate(trialStart.getDate() - 10);
      const finEtendue = new Date(trialStart); finEtendue.setDate(finEtendue.getDate() + 45);
      prisma.organisation.findUnique.mockResolvedValue(
        orgVierge({ trialStartedAt: trialStart, abonnementActifJusquAu: finEtendue }),
      );

      await expect(service.demanderExtension(USER_ID, 'c-1')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.organisation.update).not.toHaveBeenCalled();
    });
  });

  describe('annuler', () => {
    it('collaborateur sans membership → 403', async () => {
      prisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.annuler(USER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('annule la subscription DE L ORG et reset org seule (L3c)', async () => {
      prisma.organisation.findUnique.mockResolvedValue(
        orgVierge({ mollieSubscriptionId: 'sub_1', mollieCustomerId: 'cst_1', planAbonnement: 'PILOTAGE' }),
      );
      await service.annuler(USER_ID);
      expect(mockedMollie.customerSubscriptions.cancel).toHaveBeenCalledWith('sub_1', { customerId: 'cst_1' });
      expect(prisma.organisation.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'org-1' }, data: expect.objectContaining({ mollieSubscriptionId: null }) }),
      );
      expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
    });
  });
});
