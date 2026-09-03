import { ForbiddenException } from '@nestjs/common';
import { SejourService } from './sejour.service';
import { getOrganisationPrincipale } from '../organisations/organisation.helpers';

/**
 * Garde séparée de update() (S2, chantier #38 SC1) :
 * - DRAFT : tous les champs modifiables (comportement historique) ;
 * - CONVENTION / SIGNE_DIRECTION : prix et dateLimiteInscription seulement ;
 * - autres statuts (OPTION, SUBMITTED…) : rien ;
 * - idempotence du mail « paiement disponible » : envoyé uniquement au premier
 *   passage 0/null → > 0.
 */

jest.mock('../organisations/organisation.helpers', () => ({
  getOrganisationPrincipale: jest.fn().mockResolvedValue({ nom: 'Collège Test' }),
}));

const USER_ID = 'orga-1';

function sejourBase(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'sej-1',
    titre: 'Séjour test',
    statut: 'DRAFT',
    createurId: USER_ID,
    prix: 0,
    createur: { id: USER_ID },
    demandes: [],
    ...over,
  };
}

function mockPrisma(sejour: ReturnType<typeof sejourBase>, autorisations: unknown[] = []) {
  return {
    sejour: {
      findUnique: jest.fn().mockResolvedValue(sejour),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...sejour, ...data })),
    },
    demandeDevis: { update: jest.fn().mockResolvedValue({}) },
    autorisationParentale: { findMany: jest.fn().mockResolvedValue(autorisations) },
  };
}

function mockEmail() {
  return { sendPaiementDisponible: jest.fn().mockResolvedValue(undefined) };
}

function makeService(prisma: unknown, email: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new SejourService(prisma as any, email as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  (getOrganisationPrincipale as jest.Mock).mockResolvedValue({ nom: 'Collège Test' });
});

describe('SejourService.update — garde par statut', () => {
  it('DRAFT : accepte les champs d\'appel d\'offres ET le prix', async () => {
    const prisma = mockPrisma(sejourBase({ statut: 'DRAFT' }));
    const service = makeService(prisma, mockEmail());

    await service.update('sej-1', { niveauClasse: '6ème', prix: 50, heureArrivee: '10:00' }, USER_ID);

    expect(prisma.sejour.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ niveauClasse: '6ème', prix: 50, heureArrivee: '10:00' }),
      }),
    );
  });

  it('CONVENTION : accepte prix et dateLimiteInscription', async () => {
    const prisma = mockPrisma(sejourBase({ statut: 'CONVENTION' }));
    const service = makeService(prisma, mockEmail());

    await service.update('sej-1', { prix: 120, dateLimiteInscription: '2026-10-01' }, USER_ID);

    expect(prisma.sejour.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ prix: 120, dateLimiteInscription: new Date('2026-10-01') }),
      }),
    );
  });

  it('SIGNE_DIRECTION : accepte le prix', async () => {
    const prisma = mockPrisma(sejourBase({ statut: 'SIGNE_DIRECTION' }));
    const service = makeService(prisma, mockEmail());

    await service.update('sej-1', { prix: 80 }, USER_ID);

    expect(prisma.sejour.update).toHaveBeenCalled();
  });

  it('CONVENTION : refuse un champ d\'appel d\'offres (niveauClasse)', async () => {
    const prisma = mockPrisma(sejourBase({ statut: 'CONVENTION' }));
    const service = makeService(prisma, mockEmail());

    await expect(service.update('sej-1', { niveauClasse: '5ème' }, USER_ID))
      .rejects.toThrow(ForbiddenException);
    expect(prisma.sejour.update).not.toHaveBeenCalled();
  });

  it('CONVENTION : refuse un mix prix + champ d\'appel d\'offres', async () => {
    const prisma = mockPrisma(sejourBase({ statut: 'CONVENTION' }));
    const service = makeService(prisma, mockEmail());

    await expect(service.update('sej-1', { prix: 100, transportSurPlace: true }, USER_ID))
      .rejects.toThrow(ForbiddenException);
  });

  it('OPTION : refuse le prix (D12 — enregistrement conditionné à la signature)', async () => {
    const prisma = mockPrisma(sejourBase({ statut: 'OPTION' }));
    const service = makeService(prisma, mockEmail());

    await expect(service.update('sej-1', { prix: 100 }, USER_ID))
      .rejects.toThrow(ForbiddenException);
  });

  it('SUBMITTED : refuse tout', async () => {
    const prisma = mockPrisma(sejourBase({ statut: 'SUBMITTED' }));
    const service = makeService(prisma, mockEmail());

    await expect(service.update('sej-1', { prix: 100 }, USER_ID))
      .rejects.toThrow(ForbiddenException);
  });

  it('refuse un non-créateur', async () => {
    const prisma = mockPrisma(sejourBase({ statut: 'CONVENTION' }));
    const service = makeService(prisma, mockEmail());

    await expect(service.update('sej-1', { prix: 100 }, 'autre-user'))
      .rejects.toThrow(ForbiddenException);
  });
});

describe('SejourService.update — idempotence du mail « paiement disponible »', () => {
  const autorisations = [
    { parentEmail: 'parent@test.local', elevePrenom: 'Léa', eleveNom: 'DURAND', tokenAcces: 'tok-1' },
    { parentEmail: null, elevePrenom: 'Sam', eleveNom: 'SAISIE', tokenAcces: 'tok-2' },
  ];

  it('premier passage 0 → 100 : un mail par autorisation avec parentEmail', async () => {
    const prisma = mockPrisma(sejourBase({ statut: 'CONVENTION', prix: 0 }), autorisations);
    const email = mockEmail();
    const service = makeService(prisma, email);

    await service.update('sej-1', { prix: 100 }, USER_ID);

    expect(email.sendPaiementDisponible).toHaveBeenCalledTimes(1);
    expect(email.sendPaiementDisponible).toHaveBeenCalledWith(
      'parent@test.local', 'Séjour test', 'Collège Test', expect.any(String), 'Léa', 'DURAND', expect.stringContaining('tok-1'),
    );
  });

  it('prix null en base → traité comme 0, le mail part', async () => {
    const prisma = mockPrisma(sejourBase({ statut: 'CONVENTION', prix: null }), autorisations);
    const email = mockEmail();
    const service = makeService(prisma, email);

    await service.update('sej-1', { prix: 100 }, USER_ID);

    expect(email.sendPaiementDisponible).toHaveBeenCalledTimes(1);
  });

  it('deux updates successifs : le second (100 → 120) n\'envoie RIEN', async () => {
    // Premier update : prix passe de 0 à 100 → mail.
    const prisma1 = mockPrisma(sejourBase({ statut: 'CONVENTION', prix: 0 }), autorisations);
    const email = mockEmail();
    await makeService(prisma1, email).update('sej-1', { prix: 100 }, USER_ID);
    expect(email.sendPaiementDisponible).toHaveBeenCalledTimes(1);

    // Second update : le séjour porte déjà prix=100 → aucun envoi.
    const prisma2 = mockPrisma(sejourBase({ statut: 'CONVENTION', prix: 100 }), autorisations);
    await makeService(prisma2, email).update('sej-1', { prix: 120 }, USER_ID);
    expect(email.sendPaiementDisponible).toHaveBeenCalledTimes(1);
  });

  it('update sans prix : aucun envoi', async () => {
    const prisma = mockPrisma(sejourBase({ statut: 'CONVENTION', prix: 0 }), autorisations);
    const email = mockEmail();
    const service = makeService(prisma, email);

    await service.update('sej-1', { dateLimiteInscription: '2026-10-01' }, USER_ID);

    expect(email.sendPaiementDisponible).not.toHaveBeenCalled();
    expect(prisma.autorisationParentale.findMany).not.toHaveBeenCalled();
  });
});
