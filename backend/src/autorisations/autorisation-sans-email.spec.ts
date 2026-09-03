import { ForbiddenException } from '@nestjs/common';
import { AutorisationService } from './autorisation.service';
import { AutorisationController } from './autorisation.controller';

/**
 * S7 = D14 (chantier #38 SC1) : l'ajout manuel d'un élève n'envoie AUCUN mail au
 * parent. La route POST /autorisations pointe sur createSansEmail (l'ancienne
 * méthode create() avec envoi immédiat est supprimée) ; l'envoi passe
 * exclusivement par envoyerInvitations.
 */

const USER_ID = 'orga-1';

const SEJOUR = {
  id: 'sej-1',
  titre: 'Séjour test',
  createurId: USER_ID,
  dateFin: new Date('2026-12-20'),
};

function mockPrisma() {
  return {
    sejour: { findUnique: jest.fn().mockResolvedValue(SEJOUR) },
    autorisationParentale: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({ id: 'aut-1', tokenAcces: 'tok-1', emailEnvoye: false, ...data })),
      update: jest.fn().mockResolvedValue({}),
    },
  };
}

function mockEmail() {
  return { sendAutorisationParentale: jest.fn().mockResolvedValue(undefined) };
}

function makeService(prisma: unknown, email: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new AutorisationService(prisma as any, email as any, {} as any);
}

const DTO = {
  sejourId: 'sej-1',
  eleveNom: 'DURAND',
  elevePrenom: 'Léa',
  parentEmail: 'parent@test.local',
};

describe('AutorisationService.createSansEmail', () => {
  it('crée l\'autorisation sans appeler sendAutorisationParentale ni poser emailEnvoye', async () => {
    const prisma = mockPrisma();
    const email = mockEmail();
    const service = makeService(prisma, email);

    const res = await service.createSansEmail(DTO, USER_ID);

    expect(prisma.autorisationParentale.create).toHaveBeenCalledTimes(1);
    expect(email.sendAutorisationParentale).not.toHaveBeenCalled();
    expect(prisma.autorisationParentale.update).not.toHaveBeenCalled();
    expect(res.emailEnvoye).toBe(false);
  });

  it('refuse un non-créateur', async () => {
    const prisma = mockPrisma();
    const service = makeService(prisma, mockEmail());

    await expect(service.createSansEmail(DTO, 'autre-user'))
      .rejects.toThrow(ForbiddenException);
  });
});

describe('AutorisationController POST /autorisations', () => {
  it('délègue à createSansEmail (jamais d\'envoi à l\'ajout)', async () => {
    const service = { createSansEmail: jest.fn().mockResolvedValue({ id: 'aut-1' }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controller = new AutorisationController(service as any);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await controller.create(DTO as any, { id: USER_ID } as any);

    expect(service.createSansEmail).toHaveBeenCalledWith(DTO, USER_ID);
  });
});
