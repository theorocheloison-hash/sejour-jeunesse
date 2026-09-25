import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';

// getOrganisationPrincipale mocké : la résolution d'organisation est hors périmètre.
jest.mock('../organisations/organisation.helpers', () => ({
  ...jest.requireActual('../organisations/organisation.helpers'),
  getOrganisationPrincipale: jest.fn(),
}));
import { getOrganisationPrincipale } from '../organisations/organisation.helpers';

import { SejourService } from './sejour.service';

/**
 * S1 — inviterDirecteur :
 * - le devisId du body doit appartenir AU séjour (sinon IDOR en écriture) ;
 * - le passage EN_ATTENTE → EN_ATTENTE_VALIDATION ne touche qu'un devis
 *   EN_ATTENTE (updateMany gardé) et n'a lieu qu'APRÈS l'envoi réussi.
 */

const getOrgaMock = getOrganisationPrincipale as unknown as jest.Mock;

const USER_ID = 'orga-1';
const SEJOUR = {
  id: 'sejour-1',
  createurId: USER_ID,
  titre: 'Classe verte',
  placesTotales: 24,
  dateDebut: null,
  dateFin: null,
  typeContexte: 'SCOLAIRE',
  createur: { id: USER_ID, prenom: 'Anne' },
};

function mockPrisma() {
  return {
    sejour: { findUnique: jest.fn().mockResolvedValue(SEJOUR) },
    devis: {
      findUnique: jest.fn().mockResolvedValue({ sejourDirectId: 'sejour-1', demande: null }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    user: { findFirst: jest.fn().mockResolvedValue(null) },
    invitationDirecteur: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ token: 'inv-token-1' }),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

describe('SejourService.inviterDirecteur (S1)', () => {
  let prisma: PrismaMock;
  let email: { sendGenericNotification: jest.Mock };
  let service: SejourService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = mockPrisma();
    email = { sendGenericNotification: jest.fn().mockResolvedValue(undefined) };
    getOrgaMock.mockResolvedValue({ id: 'org-1', nom: 'Collège X', uai: '0750001A' });
    service = new SejourService(
      prisma as unknown as PrismaService,
      email as unknown as EmailService,
    );
  });

  it("devis d'un autre séjour → 403, rien d'écrit ni envoyé", async () => {
    prisma.devis.findUnique.mockResolvedValue({ sejourDirectId: 'autre-sejour', demande: null });
    await expect(
      service.inviterDirecteur('sejour-1', 'dir@ecole.fr', 'devis-x', USER_ID),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.devis.updateMany).not.toHaveBeenCalled();
    expect(email.sendGenericNotification).not.toHaveBeenCalled();
    expect(prisma.invitationDirecteur.create).not.toHaveBeenCalled();
  });

  it('devis introuvable → 403 (même refus, existence non révélée)', async () => {
    prisma.devis.findUnique.mockResolvedValue(null);
    await expect(
      service.inviterDirecteur('sejour-1', 'dir@ecole.fr', 'devis-x', USER_ID),
    ).rejects.toThrow(ForbiddenException);
  });

  it('devis COLLAB rattaché par sa demande au séjour → accepté', async () => {
    prisma.devis.findUnique.mockResolvedValue({ sejourDirectId: null, demande: { sejourId: 'sejour-1' } });
    const res = await service.inviterDirecteur('sejour-1', 'dir@ecole.fr', 'devis-x', USER_ID);
    expect(res).toEqual({ found: false, sent: true });
  });

  it('statut : updateMany GARDÉ sur EN_ATTENTE (un devis SELECTIONNE reste intact), APRÈS l\'email', async () => {
    const res = await service.inviterDirecteur('sejour-1', 'dir@ecole.fr', 'devis-x', USER_ID);
    expect(res).toEqual({ found: false, sent: true });

    expect(prisma.devis.updateMany).toHaveBeenCalledWith({
      where: { id: 'devis-x', statut: 'EN_ATTENTE' },
      data: { statut: 'EN_ATTENTE_VALIDATION' },
    });
    const ordreEmail = email.sendGenericNotification.mock.invocationCallOrder[0];
    const ordreStatut = prisma.devis.updateMany.mock.invocationCallOrder[0];
    expect(ordreEmail).toBeLessThan(ordreStatut);
  });

  it('échec de l\'email → statut INCHANGÉ (updateMany jamais appelé)', async () => {
    email.sendGenericNotification.mockRejectedValue(new Error('brevo down'));
    await expect(
      service.inviterDirecteur('sejour-1', 'dir@ecole.fr', 'devis-x', USER_ID),
    ).rejects.toThrow('brevo down');
    expect(prisma.devis.updateMany).not.toHaveBeenCalled();
  });

  it('cas 1 (directeur existant) : email au directeur puis statut', async () => {
    prisma.user.findFirst.mockResolvedValue({ email: 'dir@college.fr', prenom: 'Paul', nom: 'Martin' });
    const res = await service.inviterDirecteur('sejour-1', undefined, 'devis-x', USER_ID);
    expect(res).toEqual({ found: true });
    expect(email.sendGenericNotification).toHaveBeenCalledTimes(1);
    expect(prisma.devis.updateMany).toHaveBeenCalledTimes(1);
  });

  it('sans devisId : aucun updateMany', async () => {
    await service.inviterDirecteur('sejour-1', 'dir@ecole.fr', undefined, USER_ID);
    expect(prisma.devis.updateMany).not.toHaveBeenCalled();
    expect(prisma.devis.findUnique).not.toHaveBeenCalled();
  });
});
