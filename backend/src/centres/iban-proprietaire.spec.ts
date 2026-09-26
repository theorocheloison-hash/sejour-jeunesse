import { ForbiddenException } from '@nestjs/common';

// getCentreForUser mocké (résolution du centre hors périmètre) ; le reste du
// helper (statutValidationCentre, estProprietaireCentre…) reste RÉEL.
jest.mock('./centre.helper', () => ({
  ...jest.requireActual('./centre.helper'),
  getCentreForUser: jest.fn(),
}));
import { getCentreForUser } from './centre.helper';

import { CentreService } from './centre.service';
import type { UpdateCentreDto } from './dto/update-centre.dto';

/**
 * Lot A — IBAN réservé au PROPRIÉTAIRE du centre (décision Théo) : un
 * collaborateur (permission parametres) peut enregistrer le profil, mais toute
 * modification de l'IBAN — y compris son effacement — est refusée (403), même
 * prédicat que le mandat de facturation. Valeur identique après normalisation
 * → champ retiré du data, l'enregistrement passe.
 */

const getCentreForUserMock = getCentreForUser as unknown as jest.Mock;

const IBAN_STOCKE = 'FR7630001007941234567890185';

// Centre VALIDÉ (claim VALIDE → le verrou S4 ne joue pas) appartenant à user-heb.
function centreValide(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'centre-1',
    statut: 'ACTIVE',
    organisationId: 'org-1',
    userId: 'user-heb',
    nom: 'Chalet des Nants',
    adresse: '1 rue des Alpes',
    codePostal: '74000',
    ville: 'Annecy',
    telephone: '04 50 12 34 56',
    email: 'contact@x.fr',
    siteWeb: 'https://www.x.fr',
    siret: '12345678901234',
    tvaIntracommunautaire: null,
    iban: IBAN_STOCKE,
    ...over,
  };
}

function mockPrisma() {
  return {
    membership: {
      findUnique: jest.fn().mockResolvedValue({ claimStatut: 'VALIDE' }),
    },
    centreHebergement: {
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'centre-1', ...data })),
    },
  };
}

type PrismaMock = ReturnType<typeof mockPrisma>;

function makeService(prisma: PrismaMock) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new CentreService(prisma as any, {} as any, {} as any, {} as any);
}

describe('CentreService.updateMonProfil — IBAN réservé au propriétaire (lot A)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('collaborateur + IBAN modifié → 403 avec le libellé', async () => {
    const prisma = mockPrisma();
    getCentreForUserMock.mockResolvedValue(centreValide());
    const service = makeService(prisma);

    await expect(
      service.updateMonProfil('user-collab', { iban: 'FR7699999999999999999999999' } as UpdateCentreDto),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.updateMonProfil('user-collab', { iban: 'FR7699999999999999999999999' } as UpdateCentreDto),
    ).rejects.toThrow('Seul le propriétaire du centre peut modifier l\'IBAN.');
    expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
  });

  it('collaborateur + IBAN identique à espaces près → OK, iban non écrit', async () => {
    const prisma = mockPrisma();
    getCentreForUserMock.mockResolvedValue(centreValide());
    const service = makeService(prisma);

    await service.updateMonProfil('user-collab', {
      iban: 'FR76 3000 1007 9412 3456 7890 185',
      description: 'x',
    } as UpdateCentreDto);

    expect(prisma.centreHebergement.update).toHaveBeenCalledTimes(1);
    const { data } = prisma.centreHebergement.update.mock.calls[0][0];
    expect(data).not.toHaveProperty('iban');
    expect(data.description).toBe('x');
  });

  it('collaborateur + IBAN null (effacement) → 403', async () => {
    const prisma = mockPrisma();
    getCentreForUserMock.mockResolvedValue(centreValide());
    const service = makeService(prisma);

    await expect(
      service.updateMonProfil('user-collab', { iban: null } as unknown as UpdateCentreDto),
    ).rejects.toThrow('Seul le propriétaire du centre peut modifier l\'IBAN.');
    expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
  });

  it('propriétaire + IBAN modifié → OK, écrit', async () => {
    const prisma = mockPrisma();
    getCentreForUserMock.mockResolvedValue(centreValide());
    const service = makeService(prisma);

    await service.updateMonProfil('user-heb', { iban: 'FR7699999999999999999999999' } as UpdateCentreDto);

    const { data } = prisma.centreHebergement.update.mock.calls[0][0];
    expect(data.iban).toBe('FR7699999999999999999999999');
  });

  it('propriétaire + IBAN null → OK, effacé', async () => {
    const prisma = mockPrisma();
    getCentreForUserMock.mockResolvedValue(centreValide());
    const service = makeService(prisma);

    await service.updateMonProfil('user-heb', { iban: null } as unknown as UpdateCentreDto);

    const { data } = prisma.centreHebergement.update.mock.calls[0][0];
    expect(data.iban).toBeNull();
  });
});
