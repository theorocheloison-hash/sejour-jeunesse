import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import type { StorageService } from '../storage/storage.service';
import type { ClientsService } from '../clients/clients.service';
import type { SequenceService } from '../sequence/sequence.service';
import type { OccupationsService } from '../chambres/occupations.service';

// getCentreForUser mocké (résolution du centre hors périmètre) ; le reste du
// helper (assertEnvoiExterneAutorise…) reste réel.
jest.mock('../centres/centre.helper', () => ({
  ...jest.requireActual('../centres/centre.helper'),
  getCentreForUser: jest.fn(),
}));
import { getCentreForUser } from '../centres/centre.helper';

import { DevisService } from './devis.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Tests de l'expiration glissante + régénération du lien public de signature :
 * - garde 404 UNIFORME (identique au token inconnu) sur les 5 routes publiques,
 *   appliquée seulement avec { verifierExpiration: true } (contrôleur public) ;
 * - exemption des chemins connectés (pas d'opts → pas de garde) ;
 * - devis signé : GET consultable même expiré ; legacy NULL : autorisé + warn ;
 * - armement : enregistrerEnvoi / création / relance cron repoussent l'expiration ;
 * - regenerer-lien : rotation du token + purge des invitations direction pendantes.
 */

const getCentreForUserMock = getCentreForUser as unknown as jest.Mock;

const DANS_30_JOURS = () => new Date(Date.now() + 30 * 86400000);
const EXPIRE = () => new Date(Date.now() - 60_000);

function mockPrisma() {
  const tx = {
    devis: { update: jest.fn().mockResolvedValue({}) },
    invitationDirecteur: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  };
  return {
    tx,
    devis: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    ligneDevis: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    sejour: { findUnique: jest.fn() },
    user: { findUnique: jest.fn().mockResolvedValue({ email: 'heb@centre.fr' }) },
    sejourClient: { findFirst: jest.fn().mockResolvedValue(null) },
    activiteClient: { create: jest.fn().mockResolvedValue({}) },
    invitationDirecteur: { create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn() },
    membership: { findUnique: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (arg: unknown) =>
      typeof arg === 'function' ? (arg as (t: unknown) => Promise<unknown>)(tx) : Promise.all(arg as Promise<unknown>[]),
    ),
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

function centreActive(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'centre-1', nom: 'Chalet des Nants', statut: 'ACTIVE',
    email: 'contact@centre.fr', iban: null, organisationId: null, userId: 'user-heb',
    ...over,
  };
}

/** Devis complet (scalaires + relations des 5 lecteurs publics), ouvert par défaut. */
function devisPublic(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'devis-1',
    centreId: 'centre-1',
    isComplementaire: false,
    statut: 'EN_ATTENTE',
    nomSignataireDirecteur: null,
    dateSignatureDirecteur: null,
    signatureDocumentUrl: null,
    signatureDirecteur: null,
    lienSignatureExpiresAt: DANS_30_JOURS(),
    numeroDevis: 'DEV-2026-0099',
    montantHT: 100, montantTVA: 0, montantTTC: 100, tauxTva: 0,
    pourcentageAcompte: 30, montantAcompte: 30,
    description: null, conditionsAnnulation: null,
    nomEntreprise: null, adresseEntreprise: null, siretEntreprise: null,
    emailEntreprise: null, telEntreprise: null,
    createdAt: new Date(), documentUrl: null, contratUrl: null,
    demandeId: null,
    sejourDirectId: 'sejour-1',
    lignes: [],
    centre: { nom: 'Chalet des Nants', email: 'contact@centre.fr' },
    sejourDirect: {
      id: 'sejour-1', titre: 'Classe verte', clientNom: 'Dupont', clientPrenom: 'Anne',
      clientEmail: 'client@ecole.fr', clientOrganisation: null, clientOrganisationId: null,
      dateDebut: null, dateFin: null, modeGestion: 'DIRECT',
    },
    demande: null,
    ...over,
  };
}

describe('lien de signature — expiration + régénération', () => {
  let prisma: PrismaMock;
  let email: { sendGenericNotification: jest.Mock };
  let storage: { upload: jest.Mock; fetchAsBuffer: jest.Mock; uploadBuffer: jest.Mock };
  let sequence: { generer: jest.Mock };
  let service: DevisService;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mockPrisma();
    email = { sendGenericNotification: jest.fn().mockResolvedValue(undefined) };
    storage = { upload: jest.fn(), fetchAsBuffer: jest.fn(), uploadBuffer: jest.fn() };
    sequence = { generer: jest.fn().mockResolvedValue(7) };
    getCentreForUserMock.mockResolvedValue(centreActive());
    service = new DevisService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
      storage as unknown as StorageService,
      {} as ClientsService,
      sequence as unknown as SequenceService,
      {} as OccupationsService,
    );
    warnSpy = jest.spyOn((service as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('getDevisPublicByToken (contrôleur public)', () => {
    it('token inconnu et lien expiré → le MÊME 404 (message identique, existence non révélée)', async () => {
      prisma.devis.findUnique.mockResolvedValueOnce(null);
      let msgInconnu = '';
      await service.getDevisPublicByToken('t', { verifierExpiration: true })
        .catch((e: NotFoundException) => { msgInconnu = e.message; });

      prisma.devis.findUnique.mockResolvedValueOnce(devisPublic({ lienSignatureExpiresAt: EXPIRE() }));
      let msgExpire = '';
      await service.getDevisPublicByToken('t', { verifierExpiration: true })
        .catch((e: NotFoundException) => { msgExpire = e.message; });

      expect(msgInconnu).toBe('Lien de signature invalide');
      expect(msgExpire).toBe(msgInconnu);
    });

    it('ouvert + non expiré → OK', async () => {
      prisma.devis.findUnique.mockResolvedValue(devisPublic());
      const res = await service.getDevisPublicByToken('t', { verifierExpiration: true });
      expect(res.id).toBe('devis-1');
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('ouvert + expiration NULL (legacy) → OK + warn', async () => {
      prisma.devis.findUnique.mockResolvedValue(devisPublic({ lienSignatureExpiresAt: null }));
      const res = await service.getDevisPublicByToken('t', { verifierExpiration: true });
      expect(res.id).toBe('devis-1');
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it('devis signé + lien expiré → GET toujours consultable (lecture seule)', async () => {
      prisma.devis.findUnique.mockResolvedValue(devisPublic({
        nomSignataireDirecteur: 'M. Dupont',
        statut: 'SELECTIONNE',
        lienSignatureExpiresAt: EXPIRE(),
      }));
      const res = await service.getDevisPublicByToken('t', { verifierExpiration: true });
      expect(res.isSigned).toBe(true);
    });
  });

  describe('autres routes publiques sur lien expiré (opts posé)', () => {
    const opts = { verifierExpiration: true };

    it('getContratPdfByToken → 404, storage jamais appelé', async () => {
      prisma.devis.findUnique.mockResolvedValue(devisPublic({ lienSignatureExpiresAt: EXPIRE(), contratUrl: 'x.pdf' }));
      await expect(service.getContratPdfByToken('t', opts)).rejects.toThrow(NotFoundException);
      expect(storage.fetchAsBuffer).not.toHaveBeenCalled();
    });

    it('signerDevisDirect → 404, aucune transaction', async () => {
      prisma.devis.findUnique.mockResolvedValue(devisPublic({ lienSignatureExpiresAt: EXPIRE() }));
      await expect(
        service.signerDevisDirect('t', { nomSignataire: 'X', confirmation: true }, {} as Request, undefined, opts),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('envoyerADirection → 404, aucune invitation créée', async () => {
      prisma.devis.findUnique.mockResolvedValue(devisPublic({ lienSignatureExpiresAt: EXPIRE() }));
      await expect(
        service.envoyerADirection('t', { emailDirecteur: 'dir@ecole.fr' }, undefined, opts),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.invitationDirecteur.create).not.toHaveBeenCalled();
    });

    it('uploadSignaturePublic → 404, aucun upload', async () => {
      prisma.devis.findUnique.mockResolvedValue(devisPublic({ lienSignatureExpiresAt: EXPIRE() }));
      await expect(
        service.uploadSignaturePublic('t', { mimetype: 'application/pdf' } as Express.Multer.File, {} as Request, undefined, undefined, opts),
      ).rejects.toThrow(NotFoundException);
      expect(storage.upload).not.toHaveBeenCalled();
    });
  });

  describe('chemin connecté organisateur (pas d’opts → pas de garde)', () => {
    it('envoyerADirection sur devis expiré SANS opts → passe (invitation créée)', async () => {
      prisma.devis.findUnique.mockResolvedValue(devisPublic({ lienSignatureExpiresAt: EXPIRE() }));
      const res = await service.envoyerADirection('t', { emailDirecteur: 'dir@ecole.fr' }, 'user-org');
      expect(res.success).toBe(true);
      expect(prisma.invitationDirecteur.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('armement de l’expiration', () => {
    it('marquerEnvoye (enregistrerEnvoi) repousse lienSignatureExpiresAt', async () => {
      prisma.devis.findUnique.mockResolvedValue(devisPublic());
      await service.marquerEnvoye('devis-1', {}, 'user-heb');
      const { data } = prisma.devis.update.mock.calls[0][0];
      expect(data.lienSignatureExpiresAt).toBeInstanceOf(Date);
      expect(data.lienSignatureExpiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('createDevisComplementaire pose lienSignatureExpiresAt à la création', async () => {
      prisma.sejour.findUnique.mockResolvedValue({ id: 'sejour-1', hebergementSelectionneId: 'centre-1', deletedAt: null });
      prisma.devis.create.mockResolvedValue({ id: 'devis-c' });
      prisma.devis.findUnique.mockResolvedValue({ id: 'devis-c', lignes: [] });

      await service.createDevisComplementaire(
        {
          sejourDirectId: 'sejour-1',
          destinataireNom: 'Association sportive',
          lignes: [{ description: 'Part AS', quantite: 1, prixUnitaire: 100, tva: 0, totalHT: 100, totalTTC: 100 }],
        } as Parameters<DevisService['createDevisComplementaire']>[0],
        'user-heb',
      );

      const { data } = prisma.devis.create.mock.calls[0][0];
      expect(data.lienSignatureExpiresAt).toBeInstanceOf(Date);
    });
  });

  describe('relance cron (notifications.service)', () => {
    const OLD_ENV = process.env.ENABLE_CRON;
    afterAll(() => { process.env.ENABLE_CRON = OLD_ENV; });

    function devisRelance(over: Partial<Record<string, unknown>> = {}) {
      return {
        id: 'devis-1',
        tokenSignature: 'tok-1',
        sejourDirectId: 'sejour-1',
        dateEnvoi: new Date(Date.now() - 40 * 86400000),
        relanceEnvoyeeAt: null,
        escaladeHebergeurAt: null,
        montantTTC: 100,
        sejourDirect: { titre: 'Classe verte', clientNom: 'Dupont', clientPrenom: 'Anne', clientEmail: 'client@ecole.fr' },
        demande: null,
        centre: { id: 'centre-1', nom: 'Chalet', email: 'contact@centre.fr', user: { email: 'heb@centre.fr' } },
        ...over,
      };
    }

    it('relance DIRECT (email avec lien) → prolonge lienSignatureExpiresAt', async () => {
      process.env.ENABLE_CRON = 'true';
      const notif = new NotificationsService(
        prisma as unknown as PrismaService,
        email as unknown as EmailService,
      );
      prisma.devis.findMany.mockResolvedValue([devisRelance()]);

      await notif.relancerDevisEnAttente();

      expect(email.sendGenericNotification).toHaveBeenCalledTimes(1);
      const { data } = prisma.devis.update.mock.calls[0][0];
      expect(data.relanceEnvoyeeAt).toBeInstanceOf(Date);
      expect(data.lienSignatureExpiresAt).toBeInstanceOf(Date);
    });

    it('relance COLLAB (email vers /login, sans lien) → ne prolonge PAS', async () => {
      process.env.ENABLE_CRON = 'true';
      const notif = new NotificationsService(
        prisma as unknown as PrismaService,
        email as unknown as EmailService,
      );
      prisma.devis.findMany.mockResolvedValue([devisRelance({
        sejourDirectId: null,
        sejourDirect: null,
        demande: { enseignant: { prenom: 'Éric', nom: 'E', email: 'e@ecole.fr' }, sejour: { titre: 'Séjour' } },
      })]);

      await notif.relancerDevisEnAttente();

      const { data } = prisma.devis.update.mock.calls[0][0];
      expect(data.relanceEnvoyeeAt).toBeInstanceOf(Date);
      expect(data).not.toHaveProperty('lienSignatureExpiresAt');
    });
  });

  describe('regenererLienSignature', () => {
    it('devis introuvable → 404', async () => {
      prisma.devis.findUnique.mockResolvedValue(null);
      await expect(service.regenererLienSignature('inconnu', 'user-heb')).rejects.toThrow(NotFoundException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("devis d'un autre centre → 403", async () => {
      prisma.devis.findUnique.mockResolvedValue({ id: 'devis-1', centreId: 'centre-2', isComplementaire: false });
      await expect(service.regenererLienSignature('devis-1', 'user-heb')).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('devis complémentaire → refus', async () => {
      prisma.devis.findUnique.mockResolvedValue({ id: 'devis-1', centreId: 'centre-1', isComplementaire: true });
      await expect(service.regenererLienSignature('devis-1', 'user-heb')).rejects.toThrow(ForbiddenException);
    });

    it('devis SIGNÉ autorisé : token régénéré + expiration réarmée, SANS trace d’envoi', async () => {
      prisma.devis.findUnique.mockResolvedValue({
        id: 'devis-1', centreId: 'centre-1', isComplementaire: false,
        numeroDevis: 'DEV-2026-0099', sejourDirectId: 'sejour-1', demande: null,
      });

      const res = await service.regenererLienSignature('devis-1', 'user-heb');

      expect(res).toEqual({ success: true });
      const { where, data } = prisma.tx.devis.update.mock.calls[0][0];
      expect(where).toEqual({ id: 'devis-1' });
      expect(data.tokenSignature).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(data.lienSignatureExpiresAt).toBeInstanceOf(Date);
      expect(data).not.toHaveProperty('dateEnvoi');
      expect(data).not.toHaveProperty('nombreEnvois');
      expect(data).not.toHaveProperty('dernierDestinataireEnvoi');
    });

    it('invitations direction PENDANTES supprimées, signées/utilisées conservées (clause where)', async () => {
      prisma.devis.findUnique.mockResolvedValue({
        id: 'devis-1', centreId: 'centre-1', isComplementaire: false,
        numeroDevis: null, sejourDirectId: null, demande: { sejourId: 'sejour-2' },
      });

      await service.regenererLienSignature('devis-1', 'user-heb');

      expect(prisma.tx.invitationDirecteur.deleteMany).toHaveBeenCalledWith({
        where: { devisId: 'devis-1', signeAt: null, utilisedAt: null },
      });
    });

    it('log CRM canal DEVIS_LIEN_REGENERE si fiche client, échec non bloquant', async () => {
      prisma.devis.findUnique.mockResolvedValue({
        id: 'devis-1', centreId: 'centre-1', isComplementaire: false,
        numeroDevis: 'DEV-2026-0099', sejourDirectId: 'sejour-1', demande: null,
      });
      prisma.sejourClient.findFirst.mockResolvedValue({ clientId: 'client-1' });

      await service.regenererLienSignature('devis-1', 'user-heb');
      const { data } = prisma.activiteClient.create.mock.calls[0][0];
      expect(data.metadata.emailType).toBe('DEVIS_LIEN_REGENERE');
      expect(data.description).toContain('régénéré');

      prisma.sejourClient.findFirst.mockRejectedValue(new Error('boom'));
      await expect(service.regenererLienSignature('devis-1', 'user-heb')).resolves.toEqual({ success: true });
    });
  });
});
