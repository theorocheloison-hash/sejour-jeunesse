import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';

// getCentreForUser mocké (résolution du centre hors périmètre) ; le reste du
// helper (statutValidationCentre, estCentreValide…) reste RÉEL.
jest.mock('./centre.helper', () => ({
  ...jest.requireActual('./centre.helper'),
  getCentreForUser: jest.fn(),
}));
import { getCentreForUser, statutValidationCentre } from './centre.helper';

import {
  CentreService,
  CHAMPS_COORDONNEES_VERROUILLES,
  normaliserChampCoordonnee,
} from './centre.service';
import type { UpdateCentreDto } from './dto/update-centre.dto';

/**
 * S4 — verrou des coordonnées d'un centre ACTIF revendiqué tant que la
 * revendication n'est pas validée :
 * - statutValidationCentre : source unique de la cause ;
 * - updateMonProfil : champs verrouillés présents-mais-inchangés RETIRÉS du
 *   data (l'écran renvoie tout le formulaire), vraie modification → 403 FR ;
 * - normalisation commune (imports LMDJ/APIDAE non normalisés : siteWeb sans
 *   https, téléphone avec espaces, email à casse mixte, '' ≡ null) ;
 * - getMonProfil expose coordonneesVerrouillees.
 */

const getCentreForUserMock = getCentreForUser as unknown as jest.Mock;

// Centre importé type LMDJ/APIDAE : valeurs stockées NON normalisées.
function centreImporte(over: Partial<Record<string, unknown>> = {}) {
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
    email: 'Contact@X.fr',
    siteWeb: 'www.x.fr',
    siret: '12345678901234',
    tvaIntracommunautaire: null,
    iban: null,
    ...over,
  };
}

// Le formulaire renvoie TOUT, tel qu'affiché (= tel que stocké), APRÈS le pipe
// DTO : siteWeb préfixé https:// par le Transform, siret strippé. Les champs
// vides partent en undefined (form.x || undefined), sauf nom/adresse/cp/ville.
function formulaireComplet(over: Partial<UpdateCentreDto> = {}): UpdateCentreDto {
  return {
    nom: 'Chalet des Nants',
    adresse: '1 rue des Alpes',
    codePostal: '74000',
    ville: 'Annecy',
    telephone: '04 50 12 34 56',
    email: 'Contact@X.fr',
    siteWeb: 'https://www.x.fr',
    siret: '12345678901234',
    ...over,
  } as UpdateCentreDto;
}

function mockPrisma(claimStatut: string | null) {
  return {
    membership: {
      findUnique: jest.fn().mockResolvedValue(claimStatut ? { claimStatut } : null),
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

describe('statutValidationCentre (S4)', () => {
  const centre = { statut: 'ACTIVE', organisationId: 'org-1', userId: 'user-heb' };

  it('centre PENDING → CENTRE_EN_ATTENTE (membership jamais consulté)', async () => {
    const prisma = mockPrisma(null);
    await expect(
      statutValidationCentre(prisma as unknown as PrismaService, { ...centre, statut: 'PENDING' }),
    ).resolves.toBe('CENTRE_EN_ATTENTE');
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
  });

  it.each(['EN_ATTENTE_DOCUMENT', 'EN_ATTENTE_VALIDATION', 'REFUSE'])(
    'ACTIVE + claim %s → REVENDICATION_EN_ATTENTE',
    async (claim) => {
      await expect(
        statutValidationCentre(mockPrisma(claim) as unknown as PrismaService, centre),
      ).resolves.toBe('REVENDICATION_EN_ATTENTE');
    },
  );

  it('ACTIVE + claim VALIDE → VALIDE', async () => {
    await expect(
      statutValidationCentre(mockPrisma('VALIDE') as unknown as PrismaService, centre),
    ).resolves.toBe('VALIDE');
  });

  it('ACTIVE + claim NON_APPLICABLE (comptes historiques) → VALIDE', async () => {
    await expect(
      statutValidationCentre(mockPrisma('NON_APPLICABLE') as unknown as PrismaService, centre),
    ).resolves.toBe('VALIDE');
  });

  it('ACTIVE legacy sans organisation → VALIDE (membership jamais consulté)', async () => {
    const prisma = mockPrisma(null);
    await expect(
      statutValidationCentre(prisma as unknown as PrismaService, { ...centre, organisationId: null }),
    ).resolves.toBe('VALIDE');
    expect(prisma.membership.findUnique).not.toHaveBeenCalled();
  });
});

describe('normaliserChampCoordonnee (S4)', () => {
  it("null, undefined et '' sont équivalents", () => {
    expect(normaliserChampCoordonnee('iban', null)).toBe('');
    expect(normaliserChampCoordonnee('iban', undefined)).toBe('');
    expect(normaliserChampCoordonnee('iban', '  ')).toBe('');
  });

  it('iban/siret/tva : sans espaces ni points ni tirets, majuscules', () => {
    expect(normaliserChampCoordonnee('iban', 'fr76 3000-1007.9412'))
      .toBe(normaliserChampCoordonnee('iban', 'FR7630001007 9412'));
    expect(normaliserChampCoordonnee('siret', '123 456.789-01234'))
      .toBe('12345678901234');
  });

  it('email : minuscules ; telephone : chiffres et + uniquement', () => {
    expect(normaliserChampCoordonnee('email', 'Contact@X.fr')).toBe('contact@x.fr');
    expect(normaliserChampCoordonnee('telephone', '04 50.12-34 56')).toBe('0450123456');
    expect(normaliserChampCoordonnee('telephone', '+33 4 50')).toBe('+33450');
  });

  it('siteWeb : la valeur stockée reçoit la même règle https:// que le DTO', () => {
    expect(normaliserChampCoordonnee('siteWeb', 'www.x.fr')).toBe('https://www.x.fr');
    expect(normaliserChampCoordonnee('siteWeb', 'https://www.x.fr')).toBe('https://www.x.fr');
  });
});

describe('CentreService.updateMonProfil — verrou coordonnées (S4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('revendication en attente + IBAN modifié → 403 FR avec le libellé', async () => {
    const prisma = mockPrisma('EN_ATTENTE_VALIDATION');
    getCentreForUserMock.mockResolvedValue(centreImporte());
    const service = makeService(prisma);

    await expect(
      service.updateMonProfil('user-heb', formulaireComplet({ iban: 'FR7630001007941234567890185' })),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.updateMonProfil('user-heb', formulaireComplet({ iban: 'FR7630001007941234567890185' })),
    ).rejects.toThrow(
      "Ces informations (IBAN) seront modifiables dès que l'équipe LIAVO aura validé votre revendication du centre.",
    );
    expect(prisma.centreHebergement.update).not.toHaveBeenCalled();
  });

  it('centre importé (siteWeb sans https, tél avec espaces, email à majuscules, iban null) : formulaire complet + description → 200, SEULE la description écrite', async () => {
    const prisma = mockPrisma('EN_ATTENTE_DOCUMENT');
    getCentreForUserMock.mockResolvedValue(centreImporte());
    const service = makeService(prisma);

    await service.updateMonProfil('user-heb', formulaireComplet({ description: 'Nouvelle description' }));

    expect(prisma.centreHebergement.update).toHaveBeenCalledTimes(1);
    const { data } = prisma.centreHebergement.update.mock.calls[0][0];
    expect(data.description).toBe('Nouvelle description');
    for (const champ of CHAMPS_COORDONNEES_VERROUILLES) {
      expect(data).not.toHaveProperty(champ);
    }
  });

  it('iban identique à espaces près → OK, non réécrit', async () => {
    const prisma = mockPrisma('EN_ATTENTE_VALIDATION');
    getCentreForUserMock.mockResolvedValue(centreImporte({ iban: 'FR7630001007941234567890185' }));
    const service = makeService(prisma);

    await service.updateMonProfil('user-heb', formulaireComplet({
      iban: 'FR76 3000 1007 9412 3456 7890 185',
      description: 'x',
    }));

    const { data } = prisma.centreHebergement.update.mock.calls[0][0];
    expect(data).not.toHaveProperty('iban');
  });

  it('siteWeb stocké sans https, renvoyé avec https (Transform DTO) → OK', async () => {
    const prisma = mockPrisma('EN_ATTENTE_VALIDATION');
    getCentreForUserMock.mockResolvedValue(centreImporte({ siteWeb: 'www.x.fr' }));
    const service = makeService(prisma);

    await expect(
      service.updateMonProfil('user-heb', formulaireComplet({ siteWeb: 'https://www.x.fr' })),
    ).resolves.toBeDefined();
    const { data } = prisma.centreHebergement.update.mock.calls[0][0];
    expect(data).not.toHaveProperty('siteWeb');
  });

  it('verrou actif + equipements modifiés + formulaire complet → OK, override { set } intact', async () => {
    const prisma = mockPrisma('EN_ATTENTE_VALIDATION');
    getCentreForUserMock.mockResolvedValue(centreImporte());
    const service = makeService(prisma);

    await service.updateMonProfil('user-heb', formulaireComplet({ equipements: ['wifi', 'sauna'] }));

    const { data } = prisma.centreHebergement.update.mock.calls[0][0];
    expect(data.equipements).toEqual({ set: ['wifi', 'sauna'] });
    for (const champ of CHAMPS_COORDONNEES_VERROUILLES) {
      expect(data).not.toHaveProperty(champ);
    }
  });

  it('centre PENDING ex nihilo → IBAN modifiable (comportement inchangé)', async () => {
    const prisma = mockPrisma(null);
    getCentreForUserMock.mockResolvedValue(centreImporte({ statut: 'PENDING' }));
    const service = makeService(prisma);

    await service.updateMonProfil('user-heb', formulaireComplet({ iban: 'FR7630001007941234567890185' }));

    const { data } = prisma.centreHebergement.update.mock.calls[0][0];
    expect(data.iban).toBe('FR7630001007941234567890185');
  });

  it('centre VALIDÉ → IBAN modifiable (comportement inchangé)', async () => {
    const prisma = mockPrisma('VALIDE');
    getCentreForUserMock.mockResolvedValue(centreImporte());
    const service = makeService(prisma);

    await service.updateMonProfil('user-heb', formulaireComplet({ iban: 'FR7630001007941234567890185' }));

    const { data } = prisma.centreHebergement.update.mock.calls[0][0];
    expect(data.iban).toBe('FR7630001007941234567890185');
  });
});

describe('CentreService.getMonProfil — coordonneesVerrouillees (S4)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('revendication en attente → true (le centre reste étalé dans le retour)', async () => {
    const prisma = mockPrisma('EN_ATTENTE_VALIDATION');
    getCentreForUserMock.mockResolvedValue(centreImporte());
    const res = await makeService(prisma).getMonProfil('user-heb');
    expect(res.coordonneesVerrouillees).toBe(true);
    expect(res.nom).toBe('Chalet des Nants');
    expect(res.iban).toBeNull();
  });

  it('centre validé → false', async () => {
    const prisma = mockPrisma('VALIDE');
    getCentreForUserMock.mockResolvedValue(centreImporte());
    const res = await makeService(prisma).getMonProfil('user-heb');
    expect(res.coordonneesVerrouillees).toBe(false);
  });
});
