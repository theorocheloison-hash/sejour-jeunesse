import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { CapaciteService } from './capacite.service.js';

/**
 * Capacité globale (module chambres, étage 1 — D9/D10), Prisma mocké.
 * Invariants verrouillés : « signé » = STATUTS_SEJOUR_CONFIRMES via le where
 * (jamais de liste locale), nuitées demi-ouvertes [debut, fin) (rotation du
 * samedi NON additionnée), max journalier = pic (pas la somme des chevauchants),
 * réarmement par empreinte de situation (et RIEN d'autre ne réarme — anti-bruit),
 * dates nulles hors calcul, cloisonnement centre, exactement 2 findMany.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function option(overrides: Record<string, unknown> = {}) {
  return {
    id: 'opt-1',
    titre: 'Séjour C (option)',
    dateDebut: d('2027-03-03'),
    dateFin: d('2027-03-07'),
    placesTotales: 45,
    nombreAccompagnateurs: null,
    capaciteAlerteAcquitteeAt: null,
    capaciteAlerteSituation: null,
    ...overrides,
  };
}

function signe(id: string, places: number, debut: string, fin: string, accompagnateurs: number | null = null) {
  return {
    id,
    titre: `Séjour ${id}`,
    dateDebut: d(debut),
    dateFin: d(fin),
    placesTotales: places,
    nombreAccompagnateurs: accompagnateurs,
  };
}

function mockPrisma({
  centre = {},
  options = [],
  signes = [],
  sejourUnique = null as Record<string, unknown> | null,
}: {
  centre?: Record<string, unknown>;
  options?: unknown[];
  signes?: unknown[];
  sejourUnique?: Record<string, unknown> | null;
} = {}) {
  const prisma = {
    centreHebergement: {
      // getCentreForUser avec centreId explicite → findUnique, propriétaire = user-1
      findUnique: jest.fn(async () => ({
        id: 'centre-1',
        userId: 'user-1',
        statut: 'ACTIVE',
        capacite: 120,
        ...centre,
      })),
    },
    sejour: {
      // Dispatch OPTION (statut scalaire) vs signés (statut { in: [...] })
      findMany: jest.fn(async ({ where }: { where: { statut: unknown } }) =>
        typeof where.statut === 'string' ? options : signes,
      ),
      findUnique: jest.fn(async () => sejourUnique),
      update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        id: (sejourUnique as { id: string }).id,
        capaciteAlerteAcquitteeAt: data.capaciteAlerteAcquitteeAt,
      })),
    },
  };
  return { prisma: prisma as unknown as PrismaService, mocks: prisma };
}

const getAlertes = (deps: ReturnType<typeof mockPrisma>) =>
  new CapaciteService(deps.prisma).getAlertes('user-1', 'centre-1');

const acquitter = (deps: ReturnType<typeof mockPrisma>, sejourId = 'opt-1') =>
  new CapaciteService(deps.prisma).acquitter(sejourId, 'user-1', 'centre-1');

describe('CapaciteService — alertes capacité globale (étage 1)', () => {
  it('nominal : 2 signés de 50 + option de 45 dans un 120 → alerte ACTIVE, deficit 25', async () => {
    const deps = mockPrisma({
      options: [option()],
      signes: [signe('s-1', 50, '2027-03-01', '2027-03-08'), signe('s-2', 50, '2027-03-01', '2027-03-08')],
    });
    const res = await getAlertes(deps);
    expect(res.capacite).toBe(120);
    expect(res.alertes).toHaveLength(1);
    expect(res.alertes[0]).toMatchObject({
      sejourId: 'opt-1',
      effectif: 45,
      maxOccupationSignee: 100,
      deficit: 25,
      etat: 'ACTIVE',
      capaciteAlerteAcquitteeAt: null,
    });
  });

  it('accompagnateurs comptés dans l\'effectif (option ET signés), null → 0', async () => {
    const deps = mockPrisma({
      options: [option({ placesTotales: 40, nombreAccompagnateurs: 5 })],
      signes: [signe('s-1', 70, '2027-03-01', '2027-03-08', 6)],
    });
    const res = await getAlertes(deps);
    expect(res.alertes[0]).toMatchObject({ effectif: 45, maxOccupationSignee: 76, deficit: 1 });
  });

  it('chevauchement partiel : le max journalier est le PIC, pas la somme des chevauchants', async () => {
    // A [01→05) et B [04→08) : pic 100 la nuit du 04 — somme naïve = 100 aussi mais
    // avec C [10→12) hors fenêtre commune le pic reste 100, jamais 150.
    const deps = mockPrisma({
      options: [option({ dateDebut: d('2027-03-01'), dateFin: d('2027-03-12') })],
      signes: [
        signe('s-1', 50, '2027-03-01', '2027-03-05'),
        signe('s-2', 50, '2027-03-04', '2027-03-08'),
        signe('s-3', 50, '2027-03-10', '2027-03-12'),
      ],
    });
    const res = await getAlertes(deps);
    expect(res.alertes[0].maxOccupationSignee).toBe(100);
  });

  it('rotation du samedi : fin de A = début de B → PAS d\'addition ([debut, fin) demi-ouvert)', async () => {
    const deps = mockPrisma({
      options: [option()],
      signes: [signe('s-1', 100, '2027-02-27', '2027-03-05'), signe('s-2', 100, '2027-03-05', '2027-03-10')],
    });
    const res = await getAlertes(deps);
    // Pic = 100 (jamais 200) → 100 + 45 > 120, deficit 25
    expect(res.alertes[0]).toMatchObject({ maxOccupationSignee: 100, deficit: 25 });
  });

  it('signé finissant le jour d\'arrivée de l\'option : non chevauchant, aucune alerte', async () => {
    const deps = mockPrisma({
      options: [option()],
      signes: [signe('s-1', 120, '2027-02-27', '2027-03-03')],
    });
    const res = await getAlertes(deps);
    expect(res.alertes).toHaveLength(0);
  });

  it('pas de surcapacité → aucune alerte', async () => {
    const deps = mockPrisma({
      options: [option()],
      signes: [signe('s-1', 75, '2027-03-01', '2027-03-08')],
    });
    const res = await getAlertes(deps);
    expect(res.alertes).toHaveLength(0);
  });

  it('option sans dates (défensif) : hors calcul même si la requête la laissait passer', async () => {
    const deps = mockPrisma({
      options: [option({ dateDebut: null, dateFin: null })],
      signes: [signe('s-1', 120, '2027-03-01', '2027-03-08')],
    });
    const res = await getAlertes(deps);
    expect(res.alertes).toHaveLength(0);
  });

  it('contrat des requêtes : 2 findMany, cloisonnées centre, dates non nulles, deletedAt null', async () => {
    const deps = mockPrisma({ options: [], signes: [] });
    await getAlertes(deps);
    const calls = (deps.mocks.sejour.findMany as jest.Mock).mock.calls;
    expect(calls).toHaveLength(2);
    for (const [args] of calls) {
      expect(args.where).toMatchObject({
        hebergementSelectionneId: 'centre-1',
        deletedAt: null,
        dateDebut: { not: null },
        dateFin: { not: null },
      });
    }
    // « Signé » = la constante partagée (4 statuts confirmés), jamais une liste locale réduite
    const whereSignes = calls.find(([a]) => typeof a.where.statut !== 'string')![0].where;
    expect(whereSignes.statut.in).toEqual(
      expect.arrayContaining(['CONVENTION', 'SOUMIS_RECTORAT', 'SIGNE_DIRECTION', 'DECLARE_TAM']),
    );
    expect(whereSignes.statut.in).toHaveLength(4);
  });
});

describe('CapaciteService — acquittement (D10)', () => {
  const signesSurcapacite = [signe('s-1', 50, '2027-03-01', '2027-03-08'), signe('s-2', 50, '2027-03-01', '2027-03-08')];

  it('pose capaciteAlerteAcquitteeAt + empreinte ; le GET rend alors ACQUITTEE', async () => {
    const depsPatch = mockPrisma({ signes: signesSurcapacite, sejourUnique: { ...option(), statut: 'OPTION', deletedAt: null, hebergementSelectionneId: 'centre-1' } });
    const res = await acquitter(depsPatch);
    expect(res.etat).toBe('ACQUITTEE');

    const updateArgs = (depsPatch.mocks.sejour.update as jest.Mock).mock.calls[0][0];
    expect(updateArgs.data.capaciteAlerteAcquitteeAt).toBeInstanceOf(Date);
    const empreinte = updateArgs.data.capaciteAlerteSituation;
    expect(empreinte).toMatch(/^[0-9a-f]{64}$/);

    const depsGet = mockPrisma({
      options: [option({ capaciteAlerteAcquitteeAt: new Date(), capaciteAlerteSituation: empreinte })],
      signes: signesSurcapacite,
    });
    const alertes = (await getAlertes(depsGet)).alertes;
    expect(alertes[0].etat).toBe('ACQUITTEE');
    expect(alertes[0].capaciteAlerteAcquitteeAt).toBeInstanceOf(Date);
  });

  it('sans surcapacité : rien à acquitter → BadRequest', async () => {
    const deps = mockPrisma({
      signes: [signe('s-1', 50, '2027-03-01', '2027-03-08')],
      sejourUnique: { ...option(), statut: 'OPTION', deletedAt: null, hebergementSelectionneId: 'centre-1' },
    });
    await expect(acquitter(deps)).rejects.toThrow(BadRequestException);
  });

  it('séjour introuvable ou soft-deleted → NotFound', async () => {
    await expect(acquitter(mockPrisma({ sejourUnique: null }))).rejects.toThrow(NotFoundException);
    await expect(
      acquitter(mockPrisma({ sejourUnique: { ...option(), statut: 'OPTION', deletedAt: new Date(), hebergementSelectionneId: 'centre-1' } })),
    ).rejects.toThrow(NotFoundException);
  });

  it('cloisonnement : séjour d\'un autre centre → Forbidden', async () => {
    const deps = mockPrisma({
      sejourUnique: { ...option(), statut: 'OPTION', deletedAt: null, hebergementSelectionneId: 'centre-AUTRE' },
    });
    await expect(acquitter(deps)).rejects.toThrow(ForbiddenException);
  });

  it('séjour non OPTION (signé) → BadRequest', async () => {
    const deps = mockPrisma({
      sejourUnique: { ...option(), statut: 'CONVENTION', deletedAt: null, hebergementSelectionneId: 'centre-1' },
    });
    await expect(acquitter(deps)).rejects.toThrow(BadRequestException);
  });
});

describe('CapaciteService — réarmement par empreinte de situation', () => {
  const signesInitiaux = [signe('s-1', 50, '2027-03-01', '2027-03-08'), signe('s-2', 50, '2027-03-01', '2027-03-08')];

  /** Acquitte la situation initiale et rend l'empreinte stockée. */
  async function empreinteAcquittee(): Promise<string> {
    const deps = mockPrisma({
      signes: signesInitiaux,
      sejourUnique: { ...option(), statut: 'OPTION', deletedAt: null, hebergementSelectionneId: 'centre-1' },
    });
    await acquitter(deps);
    return (deps.mocks.sejour.update as jest.Mock).mock.calls[0][0].data.capaciteAlerteSituation;
  }

  const etatApres = async (empreinte: string, mutation: { options?: unknown[]; signes?: unknown[]; centre?: Record<string, unknown> }) => {
    const deps = mockPrisma({
      options: mutation.options ?? [option({ capaciteAlerteAcquitteeAt: new Date(), capaciteAlerteSituation: empreinte })],
      signes: mutation.signes ?? signesInitiaux,
      centre: mutation.centre ?? {},
    });
    const { alertes } = await getAlertes(deps);
    return alertes[0]?.etat;
  };

  it('situation identique → reste ACQUITTEE (anti-bruit : rien d\'autre ne réarme)', async () => {
    const empreinte = await empreinteAcquittee();
    expect(await etatApres(empreinte, {})).toBe('ACQUITTEE');
  });

  it('effectif de l\'option change → ACTIVE', async () => {
    const empreinte = await empreinteAcquittee();
    expect(
      await etatApres(empreinte, {
        options: [option({ placesTotales: 50, capaciteAlerteAcquitteeAt: new Date(), capaciteAlerteSituation: empreinte })],
      }),
    ).toBe('ACTIVE');
  });

  it('dates d\'un signé chevauchant changent → ACTIVE', async () => {
    const empreinte = await empreinteAcquittee();
    expect(
      await etatApres(empreinte, {
        signes: [signe('s-1', 50, '2027-03-01', '2027-03-09'), signe('s-2', 50, '2027-03-01', '2027-03-08')],
      }),
    ).toBe('ACTIVE');
  });

  it('un signé disparaît (annulé) mais la surcapacité persiste → ACTIVE (composition changée)', async () => {
    const empreinte = await empreinteAcquittee();
    expect(
      await etatApres(empreinte, {
        signes: [signe('s-1', 90, '2027-03-01', '2027-03-08')],
      }),
    ).toBe('ACTIVE');
  });

  it('capacité du centre change (surcapacité restante) → ACTIVE', async () => {
    const empreinte = await empreinteAcquittee();
    expect(await etatApres(empreinte, { centre: { capacite: 110 } })).toBe('ACTIVE');
  });

  it('la situation se résout (un signé annulé libère la place) → plus d\'alerte du tout', async () => {
    const empreinte = await empreinteAcquittee();
    expect(
      await etatApres(empreinte, { signes: [signe('s-1', 50, '2027-03-01', '2027-03-08')] }),
    ).toBeUndefined();
  });
});

describe('CapaciteService — sur-engagement entre signés (extension 21/07)', () => {
  it('deux signés dépassant la capacité entre eux → sur-engagement, même sans option', async () => {
    const deps = mockPrisma({
      options: [],
      signes: [signe('s-1', 70, '2027-03-01', '2027-03-08'), signe('s-2', 70, '2027-03-04', '2027-03-10')],
    });
    const res = await getAlertes(deps);
    expect(res.alertes).toHaveLength(0);
    expect(res.surEngagements).toHaveLength(1);
    expect(res.surEngagements[0]).toMatchObject({
      dateDebut: d('2027-03-04'),
      dateFin: d('2027-03-08'),
      pic: 140,
      deficit: 20,
    });
    expect(res.surEngagements[0].sejours.map((s) => s.id).sort()).toEqual(['s-1', 's-2']);
  });

  it('rotation du samedi entre signés → aucun sur-engagement ([debut, fin) demi-ouvert)', async () => {
    const deps = mockPrisma({
      signes: [signe('s-1', 100, '2027-02-27', '2027-03-05'), signe('s-2', 100, '2027-03-05', '2027-03-10')],
    });
    expect((await getAlertes(deps)).surEngagements).toHaveLength(0);
  });

  it('deux fenêtres disjointes de dépassement → deux intervalles', async () => {
    const deps = mockPrisma({
      signes: [
        signe('s-1', 70, '2027-03-01', '2027-03-05'),
        signe('s-2', 70, '2027-03-01', '2027-03-05'),
        signe('s-3', 70, '2027-03-10', '2027-03-15'),
        signe('s-4', 70, '2027-03-10', '2027-03-15'),
      ],
    });
    const { surEngagements } = await getAlertes(deps);
    expect(surEngagements).toHaveLength(2);
    expect(surEngagements[0]).toMatchObject({ dateDebut: d('2027-03-01'), dateFin: d('2027-03-05'), pic: 140, deficit: 20 });
    expect(surEngagements[1]).toMatchObject({ dateDebut: d('2027-03-10'), dateFin: d('2027-03-15'), pic: 140, deficit: 20 });
  });

  it('signés sous capacité → [] ; option en surcapacité laisse surEngagements vide (calculs indépendants)', async () => {
    const deps = mockPrisma({
      options: [option()],
      signes: [signe('s-1', 50, '2027-03-01', '2027-03-08'), signe('s-2', 50, '2027-03-01', '2027-03-08')],
    });
    const res = await getAlertes(deps);
    expect(res.alertes).toHaveLength(1); // l'option est en surcapacité (100 + 45 > 120)
    expect(res.surEngagements).toHaveLength(0); // mais les signés seuls (100) ne le sont pas
  });
});
