import { InvitationCollaborationService } from './invitation-collaboration.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { EmailService } from '../email/email.service';

/**
 * Tests ciblés sur getPendantesPourUser (F2 lot A) : email rechargé en base
 * (match insensible à la casse), exclusions acceptedAt / dateFin passée,
 * filtre séjour en code (DIRECT, sans créateur, non soft-supprimé), forme de
 * réponse sans sejourId ni devisDraftJson. accepter() n'est pas couvert ici.
 */
describe('InvitationCollaborationService.getPendantesPourUser', () => {
  let prisma: {
    user: { findUnique: jest.Mock };
    invitationCollaboration: { findMany: jest.Mock };
    sejour: { findMany: jest.Mock };
  };
  let service: InvitationCollaborationService;

  const invitation = (over: Record<string, unknown> = {}) => ({
    token: 'tok-1',
    titreSejourSuggere: 'Classe verte',
    dateDebut: new Date('2026-09-10'),
    dateFin: new Date('2026-09-15'),
    nbElevesEstime: 24,
    sejourId: null,
    centre: { nom: 'Le Sauvageon', ville: 'Arêches' },
    ...over,
  });

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ email: 'prof@ecole.fr' }) },
      invitationCollaboration: { findMany: jest.fn().mockResolvedValue([]) },
      sejour: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new InvitationCollaborationService(
      prisma as unknown as PrismaService,
      {} as EmailService,
    );
  });

  it('user introuvable → [] sans requête invitations', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getPendantesPourUser('user-1')).resolves.toEqual([]);

    expect(prisma.invitationCollaboration.findMany).not.toHaveBeenCalled();
  });

  it("match insensible à la casse sur l'email rechargé en base (pas celui du JWT)", async () => {
    prisma.user.findUnique.mockResolvedValue({ email: 'Prof@Ecole.FR' });

    await service.getPendantesPourUser('user-1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { email: true },
    });
    expect(prisma.invitationCollaboration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          emailEnseignant: { equals: 'Prof@Ecole.FR', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('exclut les invitations acceptées : acceptedAt null dans le where', async () => {
    await service.getPendantesPourUser('user-1');

    const where = prisma.invitationCollaboration.findMany.mock.calls[0][0].where;
    expect(where.acceptedAt).toBeNull();
  });

  it('exclut les invitations expirées : dateFin gte minuit UTC du jour', async () => {
    await service.getPendantesPourUser('user-1');

    const gte = prisma.invitationCollaboration.findMany.mock.calls[0][0].where.dateFin.gte;
    expect(gte).toBeInstanceOf(Date);
    expect(gte.getUTCHours()).toBe(0);
    expect(gte.getUTCMinutes()).toBe(0);
    expect(gte.getUTCSeconds()).toBe(0);
    expect(gte.getUTCMilliseconds()).toBe(0);
  });

  it('sejourId null → incluse, et sejour.findMany jamais appelé si aucun sejourId non nul', async () => {
    prisma.invitationCollaboration.findMany.mockResolvedValue([invitation()]);

    const result = await service.getPendantesPourUser('user-1');

    expect(result).toHaveLength(1);
    expect(prisma.sejour.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['séjour COLLABORATIF', { id: 'sej-1', modeGestion: 'COLLABORATIF', createurId: null, deletedAt: null }],
    ['createurId déjà posé', { id: 'sej-1', modeGestion: 'DIRECT', createurId: 'user-2', deletedAt: null }],
    ['séjour soft-supprimé', { id: 'sej-1', modeGestion: 'DIRECT', createurId: null, deletedAt: new Date('2026-08-01') }],
    ['séjour introuvable', null],
  ])('invitation liée à un séjour non rattachable (%s) → exclue', async (_label, sejour) => {
    prisma.invitationCollaboration.findMany.mockResolvedValue([invitation({ sejourId: 'sej-1' })]);
    prisma.sejour.findMany.mockResolvedValue(sejour ? [sejour] : []);

    const result = await service.getPendantesPourUser('user-1');

    expect(result).toEqual([]);
    expect(prisma.sejour.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['sej-1'] } },
      select: { id: true, modeGestion: true, createurId: true, deletedAt: true },
    });
  });

  it('forme de réponse : ni sejourId ni devisDraftJson, clés attendues seulement', async () => {
    prisma.invitationCollaboration.findMany.mockResolvedValue([
      invitation({ sejourId: 'sej-1' }),
    ]);
    prisma.sejour.findMany.mockResolvedValue([
      { id: 'sej-1', modeGestion: 'DIRECT', createurId: null, deletedAt: null },
    ]);

    const result = await service.getPendantesPourUser('user-1');

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty('sejourId');
    expect(result[0]).not.toHaveProperty('devisDraftJson');
    expect(Object.keys(result[0]).sort()).toEqual(
      ['centre', 'dateDebut', 'dateFin', 'nbElevesEstime', 'titreSejourSuggere', 'token'],
    );
  });
});
