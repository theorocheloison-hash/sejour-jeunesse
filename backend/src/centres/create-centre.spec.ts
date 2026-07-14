import type { JwtService } from '@nestjs/jwt';
import type { PrismaService } from '../prisma/prisma.service';
import type { StorageService } from '../storage/storage.service';
import type { EmailService } from '../email/email.service';
import { CentreService } from './centre.service';

/**
 * Tests de createCentre : transaction atomique + résolution d'organisation par
 * la structure juridique (SIRET d'abord, puis membership VALIDE déterministe,
 * puis dédup textuelle), claimStatut dérivé de la relation entre l'utilisateur
 * et l'organisation EFFECTIVEMENT résolue.
 * Les helpers organisation/membership sont les VRAIS (pas de jest.mock) : les
 * assertions portent sur les délégués Prisma du tx mocké — « findOrCreateOrganisation
 * jamais appelé » s'observe par zéro appel sur tx.organisation.*.
 * Invariant vérifié : tout centre créé en PENDING est visible dans au moins une
 * liste admin (/admin/claims via EN_ATTENTE_DOCUMENT, ou /admin/centres/pending
 * via l'organisation au membership VALIDE).
 */

function mockTx() {
  return {
    centreHebergement: {
      count: jest.fn().mockResolvedValue(2),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'centre-new',
        ...data,
      })),
    },
    membership: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: 'membership-new',
        ...data,
      })),
    },
    organisation: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'org-new', nom: 'Org Neuve' }),
    },
  };
}

type TxMock = ReturnType<typeof mockTx>;

const DTO = {
  nom: 'Chalet des Nants',
  adresse: '1 route des Nants',
  ville: 'Vallorcine',
  codePostal: '74660',
  capacite: 60,
};

describe('CentreService.createCentre', () => {
  let tx: TxMock;
  let prisma: { $transaction: jest.Mock };
  let email: { sendGenericNotification: jest.Mock };
  let service: CentreService;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    tx = mockTx();
    prisma = {
      $transaction: jest.fn(async (cb: (tx: TxMock) => Promise<unknown>) => cb(tx)),
    };
    email = { sendGenericNotification: jest.fn().mockResolvedValue(undefined) };
    service = new CentreService(
      prisma as unknown as PrismaService,
      {} as JwtService,
      {} as StorageService,
      email as unknown as EmailService,
    );
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('membership VALIDE, sans SIRET → centre rattaché à SON organisation, dédup textuelle jamais appelée [cas Pôle Montagne]', async () => {
    tx.membership.findFirst.mockResolvedValue({ id: 'm-pole', organisationId: 'org-pole' });
    tx.membership.findUnique.mockResolvedValue({ id: 'm-pole', claimStatut: 'VALIDE' });

    const centre = await service.createCentre('user-1', DTO as any);

    // findOrCreateOrganisation n'est JAMAIS appelé : aucun accès à tx.organisation.
    expect(tx.organisation.findUnique).not.toHaveBeenCalled();
    expect(tx.organisation.findFirst).not.toHaveBeenCalled();
    expect(tx.organisation.create).not.toHaveBeenCalled();
    // organisationId posé À LA CRÉATION du centre.
    expect(tx.centreHebergement.create.mock.calls[0][0].data.organisationId).toBe('org-pole');
    expect((centre as Record<string, unknown>).statut).toBe('PENDING');
    // Membership VALIDE existant intact (helper idempotent → pas de create).
    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it('membership VALIDE, avec SIRET de SA société → dédup SIREN retrouve la MÊME organisation → NON_APPLICABLE', async () => {
    tx.organisation.findUnique.mockResolvedValue({ id: 'org-pole', nom: 'Pôle Montagne' });
    tx.membership.findFirst
      .mockResolvedValueOnce({ id: 'm-pole' }) // membershipValideSurCetteOrg
      .mockResolvedValueOnce(null); // claimValideAutre
    tx.membership.findUnique.mockResolvedValue({ id: 'm-pole', claimStatut: 'VALIDE' });

    await service.createCentre('user-1', { ...DTO, siret: '81374122000020' } as any);

    // Chemin 1 : dédup par SIREN (jamais de création d'org, même résultat que le cas 1).
    expect(tx.organisation.findUnique).toHaveBeenCalledTimes(1);
    expect(tx.organisation.findUnique.mock.calls[0][0].where).toEqual({ siren: '813741220' });
    expect(tx.organisation.create).not.toHaveBeenCalled();
    expect(tx.centreHebergement.create.mock.calls[0][0].data.organisationId).toBe('org-pole');
    expect(tx.membership.create).not.toHaveBeenCalled();
  });

  it("membership VALIDE ailleurs, avec SIRET d'une SECONDE société → org de la seconde société + EN_ATTENTE_DOCUMENT [le fix]", async () => {
    // SIREN inconnu → org créée ; aucun membership du user sur CETTE org.
    tx.organisation.create.mockResolvedValue({ id: 'org-2', nom: 'Seconde Société' });

    await service.createCentre('user-1', { ...DTO, siret: '99999999900019' } as any);

    // Le SIRET saisi n'est pas ignoré : dédup SIREN tentée puis création.
    expect(tx.organisation.findUnique.mock.calls[0][0].where).toEqual({ siren: '999999999' });
    expect(tx.organisation.create).toHaveBeenCalledTimes(1);
    expect(tx.centreHebergement.create.mock.calls[0][0].data.organisationId).toBe('org-2');
    // L'hébergeur doit justifier CETTE structure, même s'il est validé ailleurs.
    const { data } = tx.membership.create.mock.calls[0][0];
    expect(data.claimStatut).toBe('EN_ATTENTE_DOCUMENT');
    expect(data.claimSubmittedAt).toBeInstanceOf(Date);
  });

  it('sans membership VALIDE, organisation neuve → claim EN_ATTENTE_DOCUMENT (visible /admin/claims)', async () => {
    // Tous les findFirst membership (VALIDE du user, sur cette org, d'un tiers) → null.
    tx.membership.findFirst.mockResolvedValue(null);

    await service.createCentre('user-1', DTO as any);

    expect(tx.organisation.create).toHaveBeenCalledTimes(1);
    expect(tx.centreHebergement.create.mock.calls[0][0].data.organisationId).toBe('org-new');
    expect(tx.membership.create).toHaveBeenCalledTimes(1);
    const { data } = tx.membership.create.mock.calls[0][0];
    expect(data.claimStatut).toBe('EN_ATTENTE_DOCUMENT');
    expect(data.claimSubmittedAt).toBeInstanceOf(Date);
    // Email admin après commit, fire-and-forget.
    expect(email.sendGenericNotification).toHaveBeenCalledTimes(1);
  });

  it("organisation retrouvée mais revendiquée par un AUTRE hébergeur → NON_APPLICABLE, pas de claim concurrent", async () => {
    tx.membership.findFirst
      .mockResolvedValueOnce(null) // pas de membership VALIDE pour ce user (résolution)
      .mockResolvedValueOnce(null) // pas de membership VALIDE du user sur CETTE org
      .mockResolvedValueOnce({ id: 'm-tiers' }); // claim VALIDE d'un autre user sur l'org
    tx.organisation.findFirst.mockResolvedValue({ id: 'org-tiers', nom: 'Org Tiers' });

    await service.createCentre('user-1', DTO as any);

    expect(tx.organisation.create).not.toHaveBeenCalled();
    expect(tx.centreHebergement.create.mock.calls[0][0].data.organisationId).toBe('org-tiers');
    const { data } = tx.membership.create.mock.calls[0][0];
    expect(data.claimStatut).toBe('NON_APPLICABLE');
    expect(data.claimSubmittedAt).toBeNull(); // aucun tunnel de claim ouvert
  });

  it('DEUX memberships VALIDES, sans SIRET → organisation choisie de façon déterministe (claimValidatedAt le plus ancien)', async () => {
    tx.membership.findFirst.mockResolvedValue({ id: 'm-1', organisationId: 'org-ancienne' });
    tx.membership.findUnique.mockResolvedValue({ id: 'm-1', claimStatut: 'VALIDE' });

    await service.createCentre('user-1', DTO as any);

    // Plus de findFirst arbitraire : la requête est ordonnée.
    const arg = tx.membership.findFirst.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'user-1', claimStatut: 'VALIDE' });
    expect(arg.orderBy).toEqual({ claimValidatedAt: 'asc' });
    expect(tx.centreHebergement.create.mock.calls[0][0].data.organisationId).toBe('org-ancienne');
  });

  it('échec de findOrCreateOrganisation → rollback, AUCUN centre créé', async () => {
    tx.membership.findFirst.mockResolvedValue(null);
    tx.organisation.findFirst.mockRejectedValue(new Error('DB down'));

    await expect(service.createCentre('user-1', DTO as any)).rejects.toThrow('DB down');

    // L'organisation est résolue AVANT le create : le centre n'a jamais existé.
    expect(tx.centreHebergement.create).not.toHaveBeenCalled();
    expect(tx.membership.create).not.toHaveBeenCalled();
    expect(email.sendGenericNotification).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
