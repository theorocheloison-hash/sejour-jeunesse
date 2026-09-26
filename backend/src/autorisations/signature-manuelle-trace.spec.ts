import { AutorisationService } from './autorisation.service';

/**
 * Point 6a — « autorisation papier reçue » trace le compte qui a cliqué
 * (signeeManuellementParId), en unitaire comme en masse ; l'annulation l'efface.
 */
const USER = 'orga-1';
const sejour = {
  createurId: USER, modeGestion: 'COLLABORATIF', responsableInscriptions: 'ORGANISATEUR',
  hebergementSelectionneId: 'c1', hebergementSelectionne: { userId: 'heb-1' },
};

function make(autorisation: Record<string, unknown>) {
  const prisma = {
    autorisationParentale: {
      findUnique: jest.fn().mockResolvedValue({ id: 'a1', sejour, ...autorisation }),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    sejour: { findUnique: jest.fn().mockResolvedValue(sejour) },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new AutorisationService(prisma as any, {} as any, {} as any), prisma };
}

describe('signature manuelle — traçabilité', () => {
  it('unitaire : pose signeeManuellementParId = compte courant', async () => {
    const { service, prisma } = make({ signeeAt: null, signeeManuellement: false });
    await service.validerSignatureManuelle('a1', USER);
    expect(prisma.autorisationParentale.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: expect.objectContaining({ signeeManuellement: true, signeeManuellementParId: USER }),
    });
  });

  it('en masse : pose signeeManuellementParId sur toutes les lignes validées', async () => {
    const { service, prisma } = make({});
    await service.validerSignaturesBatch('sej-1', USER);
    expect(prisma.autorisationParentale.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ signeeManuellementParId: USER }) }),
    );
  });

  it('annulation : efface la trace', async () => {
    const { service, prisma } = make({ signeeAt: new Date(), signeeManuellement: true });
    await service.annulerSignatureManuelle('a1', USER);
    expect(prisma.autorisationParentale.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { signeeAt: null, signeeManuellement: false, signeeManuellementParId: null },
    });
  });
});
