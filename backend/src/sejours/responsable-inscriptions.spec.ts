import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

// getCentreForUser mocké : la résolution du centre actif est hors périmètre.
jest.mock('../centres/centre.helper', () => ({
  ...jest.requireActual('../centres/centre.helper'),
  getCentreForUser: jest.fn(),
}));
import { getCentreForUser } from '../centres/centre.helper';
import { SejourService } from './sejour.service';

/**
 * B4 — PATCH /sejours/:id/responsable-inscriptions : gardes (centre, COLLAB,
 * inscriptions ouvertes, valeur), no-op si inchangé, et sur changement effectif :
 * écriture du seul champ responsableInscriptions + trace + email organisateur.
 */

const getCentreForUserMock = getCentreForUser as unknown as jest.Mock;
const HEB = 'heb-1';

function sejour(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sej-1',
    titre: 'Classe de neige',
    deletedAt: null,
    natureSejour: 'SEJOUR',
    modeGestion: 'COLLABORATIF',
    champsInscription: { champsActifs: ['allergies'] },
    responsableInscriptions: 'ORGANISATEUR',
    hebergementSelectionneId: 'centre-1',
    hebergementSelectionne: { nom: 'Chalet Test' },
    createur: { email: 'prof@college.test', prenom: 'Anne' },
    ...over,
  };
}

function make(sej: unknown) {
  const prisma = {
    sejour: {
      findUnique: jest.fn().mockResolvedValue(sej),
      update: jest.fn().mockResolvedValue({}),
    },
    message: { create: jest.fn().mockResolvedValue({}) },
  };
  const email = { sendGenericNotification: jest.fn().mockResolvedValue(undefined) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const service = new SejourService(prisma as any, email as any);
  return { service, prisma, email };
}

beforeEach(() => {
  getCentreForUserMock.mockReset();
  getCentreForUserMock.mockResolvedValue({ id: 'centre-1' });
});

describe('B4 — updateResponsableInscriptions', () => {
  it('valeur invalide → 400, rien lu ni écrit', async () => {
    const { service, prisma } = make(sejour());
    await expect(service.updateResponsableInscriptions('sej-1', 'PARENT', HEB)).rejects.toThrow(BadRequestException);
    expect(prisma.sejour.findUnique).not.toHaveBeenCalled();
  });

  it('séjour d\'un autre centre → 403 ; supprimé → 404', async () => {
    const autre = make(sejour({ hebergementSelectionneId: 'centre-2' }));
    await expect(autre.service.updateResponsableInscriptions('sej-1', 'HEBERGEUR', HEB)).rejects.toThrow(ForbiddenException);
    const supprime = make(sejour({ deletedAt: new Date() }));
    await expect(supprime.service.updateResponsableInscriptions('sej-1', 'HEBERGEUR', HEB)).rejects.toThrow(NotFoundException);
    expect(autre.prisma.sejour.update).not.toHaveBeenCalled();
  });

  it('DIRECT, événement ou inscriptions pas ouvertes → 400, rien écrit', async () => {
    for (const over of [{ modeGestion: 'DIRECT' }, { natureSejour: 'EVENEMENT' }, { champsInscription: null }]) {
      const { service, prisma } = make(sejour(over));
      await expect(service.updateResponsableInscriptions('sej-1', 'HEBERGEUR', HEB)).rejects.toThrow(BadRequestException);
      expect(prisma.sejour.update).not.toHaveBeenCalled();
    }
  });

  it('même valeur → no-op : aucune écriture, aucune notification', async () => {
    const { service, prisma, email } = make(sejour());
    await expect(service.updateResponsableInscriptions('sej-1', 'ORGANISATEUR', HEB)).resolves.toEqual({ responsableInscriptions: 'ORGANISATEUR' });
    expect(prisma.sejour.update).not.toHaveBeenCalled();
    expect(prisma.message.create).not.toHaveBeenCalled();
    expect(email.sendGenericNotification).not.toHaveBeenCalled();
  });

  it('bascule vers HEBERGEUR : écrit SEULEMENT responsableInscriptions, trace + email organisateur', async () => {
    const { service, prisma, email } = make(sejour());
    await expect(service.updateResponsableInscriptions('sej-1', 'HEBERGEUR', HEB)).resolves.toEqual({ responsableInscriptions: 'HEBERGEUR' });
    expect(prisma.sejour.update).toHaveBeenCalledWith({ where: { id: 'sej-1' }, data: { responsableInscriptions: 'HEBERGEUR' } });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ sejourId: 'sej-1', auteurId: HEB }),
    });
    expect(email.sendGenericNotification).toHaveBeenCalledWith(
      'prof@college.test',
      expect.stringContaining('le centre prend le relais'),
      expect.any(String),
      undefined,
      undefined,
      null,
    );
  });

  it('retour vers ORGANISATEUR : email « vous reprenez la main » ; sans organisateur rattaché, pas d\'email', async () => {
    const retour = make(sejour({ responsableInscriptions: 'HEBERGEUR' }));
    await retour.service.updateResponsableInscriptions('sej-1', 'ORGANISATEUR', HEB);
    expect(retour.email.sendGenericNotification.mock.calls[0][1]).toContain('vous reprenez la main');

    const sansOrga = make(sejour({ createur: null }));
    await sansOrga.service.updateResponsableInscriptions('sej-1', 'HEBERGEUR', HEB);
    expect(sansOrga.prisma.sejour.update).toHaveBeenCalled();
    expect(sansOrga.email.sendGenericNotification).not.toHaveBeenCalled();
  });

  it('échec de la trace ou de l\'email : la bascule reste acquise', async () => {
    const { service, prisma, email } = make(sejour());
    prisma.message.create.mockRejectedValue(new Error('db'));
    email.sendGenericNotification.mockRejectedValue(new Error('brevo'));
    await expect(service.updateResponsableInscriptions('sej-1', 'HEBERGEUR', HEB)).resolves.toEqual({ responsableInscriptions: 'HEBERGEUR' });
  });
});
