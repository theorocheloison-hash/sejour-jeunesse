import { ForbiddenException } from '@nestjs/common';
import { AutorisationService } from './autorisation.service';

/**
 * P10 (passe d'ajustement #38) : envoi du lien PERSONNEL du journal aux
 * familles — un mail par autorisation avec parentEmail ET tokenAcces,
 * emailEnvoye jamais touché, {sent, skipped} retourné.
 */

const USER_ID = 'orga-1';

const SEJOUR = { id: 'sej-1', titre: 'Séjour test', createurId: USER_ID };

const AUTORISATIONS = [
  { parentEmail: 'p1@test.local', elevePrenom: 'Léa', tokenAcces: 'tok-1' },
  { parentEmail: 'p2@test.local', elevePrenom: 'Tom', tokenAcces: 'tok-2' },
  { parentEmail: null, elevePrenom: 'Sam', tokenAcces: 'tok-3' },
];

function mockPrisma() {
  return {
    sejour: { findUnique: jest.fn().mockResolvedValue(SEJOUR) },
    autorisationParentale: {
      findMany: jest.fn().mockResolvedValue(AUTORISATIONS),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
}

function mockEmail() {
  return { sendLienJournal: jest.fn().mockResolvedValue(undefined) };
}

function makeService(prisma: unknown, email: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new AutorisationService(prisma as any, email as any, {} as any);
}

describe('AutorisationService.envoyerLienJournal', () => {
  it('2 familles avec email + 1 sans → sent: 2, skipped: 1, emailEnvoye inchangé', async () => {
    const prisma = mockPrisma();
    const email = mockEmail();
    const service = makeService(prisma, email);

    const res = await service.envoyerLienJournal('sej-1', USER_ID);

    expect(res).toEqual({ sent: 2, skipped: 1 });
    expect(email.sendLienJournal).toHaveBeenCalledTimes(2);
    expect(email.sendLienJournal).toHaveBeenCalledWith(
      'p1@test.local', 'Léa', 'Séjour test', expect.stringContaining('/sejour/tok-1/journal'),
    );
    // emailEnvoye est le flag du mail d'AUTORISATION : jamais écrit ici.
    expect(prisma.autorisationParentale.update).not.toHaveBeenCalled();
    expect(prisma.autorisationParentale.updateMany).not.toHaveBeenCalled();
  });

  it('un échec d\'envoi compte en skipped, les autres partent', async () => {
    const prisma = mockPrisma();
    const email = mockEmail();
    email.sendLienJournal.mockRejectedValueOnce(new Error('smtp down'));
    const service = makeService(prisma, email);

    const res = await service.envoyerLienJournal('sej-1', USER_ID);

    expect(res).toEqual({ sent: 1, skipped: 2 });
  });

  it('refuse un non-créateur', async () => {
    const prisma = mockPrisma();
    const service = makeService(prisma, mockEmail());

    await expect(service.envoyerLienJournal('sej-1', 'autre-user'))
      .rejects.toThrow(ForbiddenException);
  });
});
