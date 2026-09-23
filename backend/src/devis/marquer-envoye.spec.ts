import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';
import type { StorageService } from '../storage/storage.service';
import type { ClientsService } from '../clients/clients.service';
import type { SequenceService } from '../sequence/sequence.service';
import type { OccupationsService } from '../chambres/occupations.service';

// getCentreForUser mocké (résolution du centre actif hors périmètre du test) ;
// assertEnvoiExterneAutorise RÉEL — le refus centre non validé est un cas testé.
jest.mock('../centres/centre.helper', () => ({
  ...jest.requireActual('../centres/centre.helper'),
  getCentreForUser: jest.fn(),
}));
import { getCentreForUser } from '../centres/centre.helper';

import { DevisService } from './devis.service';

/**
 * Tests de marquerEnvoye (trace d'envoi sans email, lien de signature copié) :
 * gardes identiques à envoyerDevis, trace dateEnvoi/nombreEnvois, écriture
 * conditionnelle de dernierDestinataireEnvoi, log CRM canal LIEN non bloquant,
 * et surtout : AUCUN email envoyé.
 */

const getCentreForUserMock = getCentreForUser as unknown as jest.Mock;

function mockPrisma() {
  return {
    devis: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({ email: 'heb@centre.fr' }),
    },
    sejourClient: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    activiteClient: {
      create: jest.fn().mockResolvedValue({}),
    },
    membership: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

function centreActive(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'centre-1',
    nom: 'Chalet des Nants',
    statut: 'ACTIVE',
    email: 'contact@centre.fr',
    iban: null,
    organisationId: null,
    userId: 'user-heb',
    ...over,
  };
}

function devisOuvert(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'devis-1',
    centreId: 'centre-1',
    isComplementaire: false,
    statut: 'EN_ATTENTE',
    nomSignataireDirecteur: null,
    dateSignatureDirecteur: null,
    signatureDocumentUrl: null,
    numeroDevis: 'DEV-2026-0076',
    montantTTC: 1234.5,
    sejourDirect: { id: 'sejour-1', natureSejour: 'SEJOUR', typeSejour: null },
    demande: null,
    ...over,
  };
}

describe('DevisService.marquerEnvoye', () => {
  let prisma: PrismaMock;
  let email: { sendGenericNotification: jest.Mock };
  let service: DevisService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mockPrisma();
    email = { sendGenericNotification: jest.fn().mockResolvedValue(undefined) };
    getCentreForUserMock.mockResolvedValue(centreActive());
    service = new DevisService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
      {} as StorageService,
      {} as ClientsService,
      {} as SequenceService,
      {} as OccupationsService,
    );
  });

  it('devis introuvable → NotFoundException, aucune écriture', async () => {
    prisma.devis.findUnique.mockResolvedValue(null);
    await expect(service.marquerEnvoye('inconnu', {}, 'user-heb')).rejects.toThrow(NotFoundException);
    expect(prisma.devis.update).not.toHaveBeenCalled();
  });

  it("devis d'un autre centre → ForbiddenException", async () => {
    prisma.devis.findUnique.mockResolvedValue(devisOuvert({ centreId: 'centre-2' }));
    await expect(service.marquerEnvoye('devis-1', {}, 'user-heb')).rejects.toThrow(ForbiddenException);
    expect(prisma.devis.update).not.toHaveBeenCalled();
  });

  it('devis complémentaire → ForbiddenException', async () => {
    prisma.devis.findUnique.mockResolvedValue(devisOuvert({ isComplementaire: true }));
    await expect(service.marquerEnvoye('devis-1', {}, 'user-heb')).rejects.toThrow(ForbiddenException);
    expect(prisma.devis.update).not.toHaveBeenCalled();
  });

  it.each([
    ['signé (nomSignataireDirecteur)', { nomSignataireDirecteur: 'M. Dupont' }],
    ['statut FACTURE_ACOMPTE', { statut: 'FACTURE_ACOMPTE' }],
    ['statut FACTURE_SOLDE', { statut: 'FACTURE_SOLDE' }],
    ['statut NON_RETENU', { statut: 'NON_RETENU' }],
  ])('devis fermé à la signature (%s) → ForbiddenException', async (_label, over) => {
    prisma.devis.findUnique.mockResolvedValue(devisOuvert(over));
    await expect(service.marquerEnvoye('devis-1', {}, 'user-heb')).rejects.toThrow(ForbiddenException);
    expect(prisma.devis.update).not.toHaveBeenCalled();
  });

  it('centre non ACTIVE + destinataire absent → ForbiddenException (assertEnvoiExterneAutorise), aucune trace', async () => {
    getCentreForUserMock.mockResolvedValue(centreActive({ statut: 'PENDING' }));
    prisma.devis.findUnique.mockResolvedValue(devisOuvert());
    await expect(service.marquerEnvoye('devis-1', {}, 'user-heb')).rejects.toThrow(ForbiddenException);
    expect(prisma.devis.update).not.toHaveBeenCalled();
    expect(email.sendGenericNotification).not.toHaveBeenCalled();
  });

  it('destinataire absent → dateEnvoi + nombreEnvois écrits, dernierDestinataireEnvoi NON écrit, aucun email', async () => {
    prisma.devis.findUnique.mockResolvedValue(devisOuvert());

    const res = await service.marquerEnvoye('devis-1', {}, 'user-heb');

    expect(res).toEqual({ success: true, message: 'Devis marqué comme transmis par lien' });
    expect(prisma.devis.update).toHaveBeenCalledTimes(1);
    const { where, data } = prisma.devis.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'devis-1' });
    expect(data.dateEnvoi).toBeInstanceOf(Date);
    expect(data.nombreEnvois).toEqual({ increment: 1 });
    expect(data).not.toHaveProperty('dernierDestinataireEnvoi');
    expect(email.sendGenericNotification).not.toHaveBeenCalled();
  });

  it('destinataire présent → dernierDestinataireEnvoi écrit', async () => {
    prisma.devis.findUnique.mockResolvedValue(devisOuvert());

    await service.marquerEnvoye('devis-1', { destinataire: 'client@ecole.fr' }, 'user-heb');

    const { data } = prisma.devis.update.mock.calls[0][0];
    expect(data.dernierDestinataireEnvoi).toBe('client@ecole.fr');
    expect(email.sendGenericNotification).not.toHaveBeenCalled();
  });

  it("séjour relié à une fiche client → log ActiviteClient canal LIEN, description « transmis par lien »", async () => {
    prisma.devis.findUnique.mockResolvedValue(devisOuvert());
    prisma.sejourClient.findFirst.mockResolvedValue({ clientId: 'client-1' });

    await service.marquerEnvoye('devis-1', {}, 'user-heb');

    expect(prisma.activiteClient.create).toHaveBeenCalledTimes(1);
    const { data } = prisma.activiteClient.create.mock.calls[0][0];
    expect(data.clientId).toBe('client-1');
    expect(data.type).toBe('DEVIS');
    expect(data.description).toContain('transmis par lien');
    expect(data.description).toContain('DEV-2026-0076');
    expect(data.metadata.canal).toBe('LIEN');
    expect(data.metadata.emailType).toBe('DEVIS_LIEN');
    expect(data.metadata).not.toHaveProperty('subject');
  });

  it('pas de fiche client → aucun log ActiviteClient', async () => {
    prisma.devis.findUnique.mockResolvedValue(devisOuvert());
    prisma.sejourClient.findFirst.mockResolvedValue(null);

    await service.marquerEnvoye('devis-1', {}, 'user-heb');

    expect(prisma.activiteClient.create).not.toHaveBeenCalled();
  });

  it("échec du log CRM → l'appel réussit quand même (non bloquant)", async () => {
    prisma.devis.findUnique.mockResolvedValue(devisOuvert());
    prisma.sejourClient.findFirst.mockRejectedValue(new Error('boom CRM'));

    const res = await service.marquerEnvoye('devis-1', {}, 'user-heb');

    expect(res.success).toBe(true);
    expect(prisma.devis.update).toHaveBeenCalledTimes(1);
  });
});
