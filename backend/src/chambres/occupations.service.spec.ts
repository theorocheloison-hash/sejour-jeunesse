import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { OccupationsService } from './occupations.service.js';
import { STATUTS_DEVIS_RETENUS } from '../devis/devis-statuts.constants.js';

/**
 * Occupations + grille + syncOccupationsSejour (sous-chantier 4a), Prisma mocké.
 * Invariants verrouillés : dérivation par STATUTS_DEVIS_RETENUS (jamais une
 * liste locale — les devis legacy FACTURE_* restent du CA confirmé),
 * chevauchement demi-ouvert [debut, fin) (rotation du samedi ≠ conflit),
 * conflit POST/sync → A_REPLACER sans échec (D12) vs PATCH/blocage → 409,
 * A_REPLACER intouché par le sync (D8), idempotence, filtre deletedAt de la
 * grille, cloisonnement multi-centre.
 *
 * Le mock occupationChambre.findMany applique RÉELLEMENT les prédicats
 * lt/gt/in/not du where : les tests de chevauchement valident la sémantique
 * demi-ouverte de la requête, pas un stub aveugle.
 */

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

type OccMock = Record<string, unknown> & { id: string };

function occ(overrides: Partial<OccMock> = {}): OccMock {
  return {
    id: 'occ-1',
    chambreId: 'ch-1',
    chambreCentreId: 'centre-1',
    dateDebut: d('2027-03-03'),
    dateFin: d('2027-03-07'),
    source: 'SEJOUR',
    statut: 'OPTION',
    sejourId: 'sej-1',
    motif: null,
    etiquette: null,
    couleur: null,
    chambre: { nom: 'Chambre 1' },
    sejour: { id: 'sej-1', titre: 'Séjour test' },
    ...overrides,
  };
}

function sejourDefaut(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sej-1',
    titre: 'Séjour test',
    deletedAt: null,
    hebergementSelectionneId: 'centre-1',
    dateDebut: d('2027-03-03'),
    dateFin: d('2027-03-07'),
    ...overrides,
  };
}

function mockPrisma({
  devisRetenus = 0,
  sejour = sejourDefaut() as Record<string, unknown> | null,
  chambres = [
    { id: 'ch-1', nom: 'Chambre 1', etage: null, ordre: 0, actif: true, lits: [{ places: 2 }] },
  ] as Array<{
    id: string; nom: string; etage: string | null; ordre: number; actif: boolean;
    lits: Array<{ places: number }>;
  }>,
  occupations = [] as OccMock[],
} = {}) {
  const occs = [...occupations];

  // Mini-moteur : interprète les prédicats réellement émis par le service.
  const matchOcc = (o: OccMock, where: any): boolean => {
    if (typeof where.chambreId === 'string' && o.chambreId !== where.chambreId) return false;
    if (where.chambreId?.in && !where.chambreId.in.includes(o.chambreId)) return false;
    if (typeof where.statut === 'string' && o.statut !== where.statut) return false;
    if (typeof where.source === 'string' && o.source !== where.source) return false;
    if (typeof where.sejourId === 'string' && o.sejourId !== where.sejourId) return false;
    // Prisma `not` inclut les NULL : seule une valeur égale est exclue (une
    // occupation sejourId=null reste candidate face à { not: 'sej-1' }).
    if (where.sejourId?.not !== undefined && o.sejourId === where.sejourId.not) return false;
    if (where.dateDebut?.lt && !((o.dateDebut as Date) < where.dateDebut.lt)) return false;
    if (where.dateFin?.gt && !((o.dateFin as Date) > where.dateFin.gt)) return false;
    if (where.id?.not && o.id === where.id.not) return false;
    return true;
  };

  let seq = 0;
  const prisma = {
    // getCentreForUser avec centreId explicite → findUnique, propriétaire = user-1
    centreHebergement: {
      findUnique: jest.fn(async ({ where }: any) => ({
        id: where.id,
        userId: 'user-1',
        statut: 'ACTIVE',
      })),
    },
    sejour: { findUnique: jest.fn(async () => sejour) },
    chambre: {
      findMany: jest.fn(async ({ where }: any = {}) =>
        chambres.filter((c) => !where?.id?.in || where.id.in.includes(c.id)),
      ),
    },
    devis: { count: jest.fn(async () => devisRetenus) },
    occupationChambre: {
      findMany: jest.fn(async ({ where }: any = {}) => occs.filter((o) => matchOcc(o, where ?? {}))),
      findFirst: jest.fn(async ({ where }: any) =>
        occs.find(
          (o) => o.id === where.id && (o.chambreCentreId ?? 'centre-1') === where.chambre?.centreId,
        ) ?? null,
      ),
      create: jest.fn(async ({ data }: any) => ({
        id: `occ-cree-${++seq}`,
        sejourId: null,
        motif: null,
        etiquette: null,
        couleur: null,
        ...data,
        sejour: data.sejourId ? { id: data.sejourId, titre: 'Séjour test' } : null,
      })),
      update: jest.fn(async ({ where, data }: any) => {
        const cible = occs.find((o) => o.id === where.id);
        if (cible) Object.assign(cible, data);
        return { ...occ(), ...(cible ?? { id: where.id }), ...data };
      }),
      delete: jest.fn(async () => ({})),
    },
    $transaction: jest.fn(async (arg: any) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
    ),
  };
  return prisma;
}

const service = (prisma: ReturnType<typeof mockPrisma>) =>
  new OccupationsService(prisma as unknown as PrismaService);

describe('OccupationsService — syncOccupationsSejour', () => {
  it('dérive par STATUTS_DEVIS_RETENUS (jamais une liste locale) et hors complémentaires', async () => {
    const prisma = mockPrisma({ devisRetenus: 1, occupations: [occ({ statut: 'OPTION' })] });
    await service(prisma).syncOccupationsSejour('sej-1');
    expect(prisma.devis.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        isComplementaire: false,
        statut: { in: STATUTS_DEVIS_RETENUS },
        OR: [{ sejourDirectId: 'sej-1' }, { demande: { sejourId: 'sej-1' } }],
      }),
    });
    // Un devis legacy FACTURE_* est dans RETENUS → l'occupation est promue FERME.
    expect(prisma.occupationChambre.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statut: 'FERME' } }),
    );
  });

  it('rétrograde FERME → OPTION quand plus aucun devis retenu (libère le stock)', async () => {
    const prisma = mockPrisma({ devisRetenus: 0, occupations: [occ({ statut: 'FERME' })] });
    await service(prisma).syncOccupationsSejour('sej-1');
    expect(prisma.occupationChambre.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { statut: 'OPTION' } }),
    );
  });

  it('promotion en conflit → A_REPLACER (jamais un échec — D12), par occupation', async () => {
    const rival = occ({
      id: 'occ-rival', statut: 'FERME', sejourId: 'sej-2',
      sejour: { id: 'sej-2', titre: '4ème Morillon' },
    });
    const libre = occ({ id: 'occ-libre', chambreId: 'ch-2', statut: 'OPTION' });
    const bloquee = occ({ id: 'occ-bloquee', statut: 'OPTION' });
    const prisma = mockPrisma({ devisRetenus: 1, occupations: [rival, bloquee, libre] });
    await expect(service(prisma).syncOccupationsSejour('sej-1')).resolves.toBeUndefined();
    expect(bloquee.statut).toBe('A_REPLACER'); // ch-1 tenue par le rival
    expect(libre.statut).toBe('FERME');        // ch-2 libre : promue quand même
  });

  it('A_REPLACER reste intouché (résolution = geste manuel — D8)', async () => {
    const prisma = mockPrisma({ devisRetenus: 1, occupations: [occ({ statut: 'A_REPLACER' })] });
    await service(prisma).syncOccupationsSejour('sej-1');
    expect(prisma.occupationChambre.update).not.toHaveBeenCalled();
  });

  it('idempotent : statut déjà à la cible → zéro update', async () => {
    const prisma = mockPrisma({ devisRetenus: 1, occupations: [occ({ statut: 'FERME' })] });
    await service(prisma).syncOccupationsSejour('sej-1');
    expect(prisma.occupationChambre.update).not.toHaveBeenCalled();
  });

  it.each(['23P01', 'occupation_non_chevauchement'])(
    'filet %s : course perdue entre check et update → A_REPLACER',
    async (marqueur) => {
      const prisma = mockPrisma({ devisRetenus: 1, occupations: [occ({ statut: 'OPTION' })] });
      prisma.occupationChambre.update.mockRejectedValueOnce(new Error(`violation ${marqueur}`));
      await expect(service(prisma).syncOccupationsSejour('sej-1')).resolves.toBeUndefined();
      expect(prisma.occupationChambre.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: { statut: 'A_REPLACER' } }),
      );
    },
  );

  it('syncOccupationsSejourSafe : un bug de sync ne remonte jamais (D12)', async () => {
    const prisma = mockPrisma();
    prisma.devis.count.mockRejectedValueOnce(new Error('boom'));
    await expect(
      service(prisma).syncOccupationsSejourSafe('sej-1', 'devis.signerDevis'),
    ).resolves.toBeUndefined();
  });
});

describe('OccupationsService — redaterOccupationsSejour (cascade dates, Lot 5)', () => {
  const ANC = { debut: d('2027-03-03'), fin: d('2027-03-07') };
  const NOUV = { debut: d('2027-03-10'), fin: d('2027-03-14') };
  const redater = (prisma: ReturnType<typeof mockPrisma>, anc: typeof ANC | null = ANC) =>
    service(prisma).redaterOccupationsSejour('sej-1', anc, NOUV, prisma as never);

  it('nominal : plage complète OPTION + FERME sans conflit → re-datées, statuts conservés', async () => {
    const opt = occ({ id: 'o-opt', chambreId: 'ch-1', statut: 'OPTION' });
    const ferme = occ({ id: 'o-ferme', chambreId: 'ch-2', statut: 'FERME' });
    const prisma = mockPrisma({ occupations: [opt, ferme] });
    const res = await redater(prisma);
    expect(res).toEqual({ redatees: 2, passeesAReplacer: 0, nonSuivies: 0 });
    expect(opt).toMatchObject({ statut: 'OPTION', dateDebut: NOUV.debut, dateFin: NOUV.fin });
    expect(ferme).toMatchObject({ statut: 'FERME', dateDebut: NOUV.debut, dateFin: NOUV.fin });
  });

  it('conflit au re-datage : FERME heurte un FERME d\'un autre séjour → A_REPLACER, dates posées quand même (D6)', async () => {
    const mien = occ({ id: 'o-mien', chambreId: 'ch-1', statut: 'FERME' });
    const rival = occ({
      id: 'o-rival', chambreId: 'ch-1', statut: 'FERME', sejourId: 'sej-2',
      dateDebut: NOUV.debut, dateFin: NOUV.fin, sejour: { id: 'sej-2', titre: 'Autre' },
    });
    const prisma = mockPrisma({ occupations: [mien, rival] });
    const res = await redater(prisma);
    expect(res).toEqual({ redatees: 0, passeesAReplacer: 1, nonSuivies: 0 });
    expect(mien).toMatchObject({ statut: 'A_REPLACER', dateDebut: NOUV.debut, dateFin: NOUV.fin });
  });

  it('rotation du samedi : nouvelle fin = début d\'un FERME rival ⇒ pas un conflit (demi-ouvert)', async () => {
    const mien = occ({ id: 'o-mien', chambreId: 'ch-1', statut: 'FERME' });
    const rival = occ({
      id: 'o-rival', chambreId: 'ch-1', statut: 'FERME', sejourId: 'sej-2',
      dateDebut: NOUV.fin, dateFin: d('2027-03-20'), sejour: { id: 'sej-2', titre: 'Autre' },
    });
    const prisma = mockPrisma({ occupations: [mien, rival] });
    const res = await redater(prisma);
    expect(res).toEqual({ redatees: 1, passeesAReplacer: 0, nonSuivies: 0 });
    expect(mien).toMatchObject({ statut: 'FERME', dateDebut: NOUV.debut, dateFin: NOUV.fin });
  });

  it('sous-période custom (dates ≠ dates séjour) : intacte, comptée nonSuivies', async () => {
    const custom = occ({
      id: 'o-custom', chambreId: 'ch-1', statut: 'FERME',
      dateDebut: d('2027-03-04'), dateFin: d('2027-03-06'),
    });
    const prisma = mockPrisma({ occupations: [custom] });
    const res = await redater(prisma);
    expect(res).toEqual({ redatees: 0, passeesAReplacer: 0, nonSuivies: 1 });
    expect(custom).toMatchObject({ dateDebut: d('2027-03-04'), dateFin: d('2027-03-06') });
    expect(prisma.occupationChambre.update).not.toHaveBeenCalled();
  });

  it('A_REPLACER : re-daté mais reste A_REPLACER (D8 — pas de re-tentative de place)', async () => {
    const ar = occ({ id: 'o-ar', chambreId: 'ch-1', statut: 'A_REPLACER' });
    const prisma = mockPrisma({ occupations: [ar] });
    const res = await redater(prisma);
    expect(res).toEqual({ redatees: 1, passeesAReplacer: 0, nonSuivies: 0 });
    expect(ar).toMatchObject({ statut: 'A_REPLACER', dateDebut: NOUV.debut, dateFin: NOUV.fin });
  });

  it('BLOCAGE : jamais touché (source ≠ SEJOUR, hors périmètre)', async () => {
    const blocage = occ({
      id: 'o-bloc', chambreId: 'ch-1', source: 'BLOCAGE', statut: 'FERME',
      sejourId: null, sejour: null,
    });
    const prisma = mockPrisma({ occupations: [blocage] });
    const res = await redater(prisma);
    expect(res).toEqual({ redatees: 0, passeesAReplacer: 0, nonSuivies: 0 });
    expect(blocage).toMatchObject({ dateDebut: ANC.debut, dateFin: ANC.fin });
    expect(prisma.occupationChambre.update).not.toHaveBeenCalled();
  });

  it('anciennes = null (séjour « à définir ») : no-op, tout compté nonSuivies', async () => {
    const o1 = occ({ id: 'o1', chambreId: 'ch-1', statut: 'OPTION' });
    const o2 = occ({ id: 'o2', chambreId: 'ch-2', statut: 'FERME' });
    const prisma = mockPrisma({ occupations: [o1, o2] });
    const res = await redater(prisma, null);
    expect(res).toEqual({ redatees: 0, passeesAReplacer: 0, nonSuivies: 2 });
    expect(prisma.occupationChambre.update).not.toHaveBeenCalled();
  });

  it('exclusion même séjour : la sous-période custom du même séjour ne fait pas passer le plage-complète en conflit', async () => {
    const plage = occ({ id: 'o-plage', chambreId: 'ch-1', statut: 'FERME' });
    const sousPeriode = occ({
      id: 'o-sous', chambreId: 'ch-1', statut: 'FERME',
      dateDebut: d('2027-03-11'), dateFin: d('2027-03-13'), // chevauche les nouvelles dates
    });
    const prisma = mockPrisma({ occupations: [plage, sousPeriode] });
    const res = await redater(prisma);
    // sans l'exclusion sejourId, le plage-complète verrait sa propre sous-période → A_REPLACER
    expect(res).toEqual({ redatees: 1, passeesAReplacer: 0, nonSuivies: 1 });
    expect(plage).toMatchObject({ statut: 'FERME', dateDebut: NOUV.debut, dateFin: NOUV.fin });
    expect(sousPeriode).toMatchObject({ dateDebut: d('2027-03-11'), dateFin: d('2027-03-13') });
  });

  it.each(['23P01', 'occupation_non_chevauchement'])(
    'filet %s : course sur l\'update FERME re-daté → A_REPLACER',
    async (marqueur) => {
      const ferme = occ({ id: 'o-ferme', chambreId: 'ch-1', statut: 'FERME' });
      const prisma = mockPrisma({ occupations: [ferme] });
      // le check ne voit pas de conflit, mais l'update (pose des dates) heurte l'EXCLUDE
      prisma.occupationChambre.update.mockRejectedValueOnce(new Error(`violation ${marqueur}`));
      const res = await redater(prisma);
      expect(res).toEqual({ redatees: 0, passeesAReplacer: 1, nonSuivies: 0 });
      expect(prisma.occupationChambre.update).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ statut: 'A_REPLACER' }) }),
      );
    },
  );
});

describe('OccupationsService — POST occupations', () => {
  it('naissance OPTION sans devis retenu, dates par défaut = celles du séjour', async () => {
    const prisma = mockPrisma({ devisRetenus: 0 });
    const res = await service(prisma).createOccupations(
      { sejourId: 'sej-1', chambreIds: ['ch-1'] }, 'user-1', 'centre-1',
    );
    expect(prisma.occupationChambre.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statut: 'OPTION', source: 'SEJOUR', sejourId: 'sej-1',
          dateDebut: d('2027-03-03'), dateFin: d('2027-03-07'),
        }),
      }),
    );
    expect(res.avertissements).toEqual([]);
  });

  it('naissance FERME si devis retenu (pas de détour par OPTION)', async () => {
    const prisma = mockPrisma({ devisRetenus: 1 });
    await service(prisma).createOccupations(
      { sejourId: 'sej-1', chambreIds: ['ch-1'] }, 'user-1', 'centre-1',
    );
    expect(prisma.occupationChambre.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statut: 'FERME' }) }),
    );
  });

  it('conflit → naît A_REPLACER + avertissement structuré, JAMAIS un échec (D12)', async () => {
    const prisma = mockPrisma({
      devisRetenus: 1,
      occupations: [occ({
        id: 'occ-rival', statut: 'FERME', sejourId: 'sej-2',
        sejour: { id: 'sej-2', titre: '4ème Morillon' },
      })],
    });
    const res = await service(prisma).createOccupations(
      { sejourId: 'sej-1', chambreIds: ['ch-1'] }, 'user-1', 'centre-1',
    );
    expect(prisma.occupationChambre.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statut: 'A_REPLACER' }) }),
    );
    expect(res.avertissements).toEqual([
      expect.objectContaining({
        chambreId: 'ch-1', nom: 'Chambre 1', statut: 'A_REPLACER',
        conflits: [expect.objectContaining({ sejourTitre: '4ème Morillon' })],
      }),
    ]);
  });

  it('rotation du samedi : fin A = début B ⇒ PAS un conflit (demi-ouvert [debut, fin))', async () => {
    const prisma = mockPrisma({
      devisRetenus: 1,
      occupations: [occ({
        id: 'occ-rival', statut: 'FERME', sejourId: 'sej-2',
        dateDebut: d('2027-02-27'), dateFin: d('2027-03-06'),
      })],
    });
    const res = await service(prisma).createOccupations(
      { sejourId: 'sej-1', chambreIds: ['ch-1'], dateDebut: '2027-03-06', dateFin: '2027-03-13' },
      'user-1', 'centre-1',
    );
    expect(prisma.occupationChambre.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ statut: 'FERME' }) }),
    );
    expect(res.avertissements).toEqual([]);
  });

  it('anti-doublon : même séjour, même chambre, dates chevauchantes → 400', async () => {
    const prisma = mockPrisma({ occupations: [occ()] });
    await expect(
      service(prisma).createOccupations(
        { sejourId: 'sej-1', chambreIds: ['ch-1'] }, 'user-1', 'centre-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('séjour sans dates et aucune date fournie → 400', async () => {
    const prisma = mockPrisma({ sejour: sejourDefaut({ dateDebut: null, dateFin: null }) });
    await expect(
      service(prisma).createOccupations(
        { sejourId: 'sej-1', chambreIds: ['ch-1'] }, 'user-1', 'centre-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('une seule des deux dates fournie → 400', async () => {
    const prisma = mockPrisma();
    await expect(
      service(prisma).createOccupations(
        { sejourId: 'sej-1', chambreIds: ['ch-1'], dateDebut: '2027-03-03' }, 'user-1', 'centre-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('cloisonnement : séjour d\'un autre centre → 403, chambre inconnue → 404', async () => {
    const autreCentre = mockPrisma({
      sejour: sejourDefaut({ hebergementSelectionneId: 'centre-2' }),
    });
    await expect(
      service(autreCentre).createOccupations(
        { sejourId: 'sej-1', chambreIds: ['ch-1'] }, 'user-1', 'centre-1',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const chambreAilleurs = mockPrisma();
    await expect(
      service(chambreAilleurs).createOccupations(
        { sejourId: 'sej-1', chambreIds: ['ch-inconnue'] }, 'user-1', 'centre-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OccupationsService — PATCH occupation', () => {
  it('marquage seul (etiquette/couleur) : aucun recalcul de statut', async () => {
    const prisma = mockPrisma({ occupations: [occ()] });
    const res = await service(prisma).updateOccupation(
      'occ-1', { etiquette: 'Filles', couleur: '#C87D2E' }, 'user-1', 'centre-1',
    );
    expect(prisma.devis.count).not.toHaveBeenCalled();
    expect(prisma.occupationChambre.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { etiquette: 'Filles', couleur: '#C87D2E' } }),
    );
    expect(res!.statut).toBe('OPTION');
  });

  it('résolution A_REPLACER : déplacement vers une chambre libre → statut dérivé FERME', async () => {
    const prisma = mockPrisma({
      devisRetenus: 1,
      chambres: [
        { id: 'ch-1', nom: 'Chambre 1', etage: null, ordre: 0, actif: true, lits: [] },
        { id: 'ch-2', nom: 'Chambre 2', etage: null, ordre: 1, actif: true, lits: [] },
      ],
      occupations: [occ({ statut: 'A_REPLACER' })],
    });
    await service(prisma).updateOccupation('occ-1', { chambreId: 'ch-2' }, 'user-1', 'centre-1');
    expect(prisma.occupationChambre.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chambreId: 'ch-2', statut: 'FERME' }),
      }),
    );
  });

  it('déplacement vers une chambre en conflit → 409 avec conflits (geste manuel, pas d\'A_REPLACER silencieux)', async () => {
    const prisma = mockPrisma({
      devisRetenus: 1,
      chambres: [
        { id: 'ch-1', nom: 'Chambre 1', etage: null, ordre: 0, actif: true, lits: [] },
        { id: 'ch-2', nom: 'Chambre 2', etage: null, ordre: 1, actif: true, lits: [] },
      ],
      occupations: [
        occ({ statut: 'A_REPLACER' }),
        occ({
          id: 'occ-rival', chambreId: 'ch-2', statut: 'FERME', sejourId: 'sej-2',
          chambre: { nom: 'Chambre 2' }, sejour: { id: 'sej-2', titre: '4ème Morillon' },
        }),
      ],
    });
    await expect(
      service(prisma).updateOccupation('occ-1', { chambreId: 'ch-2' }, 'user-1', 'centre-1'),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      response: expect.objectContaining({
        error: 'CHAMBRES_CONFLIT',
        conflits: [expect.objectContaining({ chambreId: 'ch-2', sejourTitre: '4ème Morillon' })],
      }),
    });
  });

  it('cloisonnement : occupation d\'un autre centre → 404', async () => {
    const prisma = mockPrisma({ occupations: [occ({ chambreCentreId: 'centre-2' })] });
    await expect(
      service(prisma).updateOccupation('occ-1', { etiquette: 'X' }, 'user-1', 'centre-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('OccupationsService — DELETE occupation', () => {
  it('libère (hard delete, les affectations suivent par FK Cascade)', async () => {
    const prisma = mockPrisma({ occupations: [occ()] });
    const res = await service(prisma).deleteOccupation('occ-1', 'user-1', 'centre-1');
    expect(prisma.occupationChambre.delete).toHaveBeenCalledWith({ where: { id: 'occ-1' } });
    expect(res).toEqual({ deleted: true });
  });

  it('cloisonnement : occupation d\'un autre centre → 404, rien supprimé', async () => {
    const prisma = mockPrisma({ occupations: [occ({ chambreCentreId: 'centre-2' })] });
    await expect(
      service(prisma).deleteOccupation('occ-1', 'user-1', 'centre-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.occupationChambre.delete).not.toHaveBeenCalled();
  });
});

describe('OccupationsService — POST blocages', () => {
  it('naît FERME d\'office, source BLOCAGE, sans sejourId (D11)', async () => {
    const prisma = mockPrisma();
    await service(prisma).createBlocages(
      { chambreIds: ['ch-1'], dateDebut: '2027-03-01', dateFin: '2027-03-15', motif: 'travaux plomberie' },
      'user-1', 'centre-1',
    );
    expect(prisma.occupationChambre.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ sejourId: expect.anything() }),
      }),
    );
    expect(prisma.occupationChambre.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ source: 'BLOCAGE', statut: 'FERME', motif: 'travaux plomberie' }),
      }),
    );
  });

  it('double course 23P01 (check aveugle deux fois) → 409 structuré, jamais un 500 brut', async () => {
    const prisma = mockPrisma();
    prisma.occupationChambre.create.mockRejectedValue(new Error('violation 23P01'));
    await expect(
      service(prisma).createBlocages(
        { chambreIds: ['ch-1'], dateDebut: '2027-03-01', dateFin: '2027-03-15', motif: 'travaux' },
        'user-1', 'centre-1',
      ),
    ).rejects.toMatchObject({
      constructor: ConflictException,
      response: expect.objectContaining({ error: 'CHAMBRES_CONFLIT' }),
    });
  });

  it('conflit avec un FERME existant → 409 (un blocage qui ne bloque pas n\'a pas de sens)', async () => {
    const prisma = mockPrisma({
      occupations: [occ({ id: 'occ-rival', statut: 'FERME', sejourId: 'sej-2' })],
    });
    await expect(
      service(prisma).createBlocages(
        { chambreIds: ['ch-1'], dateDebut: '2027-03-01', dateFin: '2027-03-15', motif: 'travaux' },
        'user-1', 'centre-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.occupationChambre.create).not.toHaveBeenCalled();
  });
});

describe('OccupationsService — GET grille', () => {
  const chambresGrille = [
    { id: 'ch-1', nom: 'Chambre 1', etage: 'RDC', ordre: 0, actif: true, lits: [{ places: 2 }, { places: 2 }] },
    { id: 'ch-2', nom: 'Chambre 2', etage: 'RDC', ordre: 1, actif: false, lits: [] },
    { id: 'ch-3', nom: 'Chambre 3', etage: '1er', ordre: 0, actif: false, lits: [] },
  ];

  it('paramètres manquants ou fenêtre invalide → 400', async () => {
    const s = service(mockPrisma());
    await expect(s.getGrille('user-1', 'centre-1', undefined, undefined)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.getGrille('user-1', 'centre-1', '2027-03-10', '2027-03-01')).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.getGrille('user-1', 'centre-1', '2027-03-01', '2028-04-01')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('états résumés + capacité dérivée + inactives : gardées si occupées, sinon exclues', async () => {
    const prisma = mockPrisma({
      chambres: chambresGrille,
      occupations: [
        occ({ id: 'o1', chambreId: 'ch-1', statut: 'OPTION', sejourId: 'sej-1' }),
        occ({ id: 'o2', chambreId: 'ch-1', statut: 'OPTION', sejourId: 'sej-2', sejour: { id: 'sej-2', titre: 'Autre' } }),
        occ({ id: 'o3', chambreId: 'ch-2', statut: 'A_REPLACER' }),
      ],
    });
    const res = await service(prisma).getGrille('user-1', 'centre-1', '2027-03-01', '2027-03-31');
    expect(res.chambres.map((c: any) => c.id)).toEqual(['ch-1', 'ch-2']); // ch-3 inactive ET vide : exclue
    expect(res.chambres[0]).toMatchObject({ capacite: 4, etat: { type: 'option', nbOptions: 2 } });
    expect(res.chambres[1].etat).toEqual({ type: 'a_replacer' });
  });

  it('priorité ferme > bloquee et bloquee quand seul un BLOCAGE tient la chambre', async () => {
    const prisma = mockPrisma({
      chambres: [chambresGrille[0]],
      occupations: [
        occ({ id: 'o1', chambreId: 'ch-1', statut: 'FERME', source: 'BLOCAGE', sejourId: null, sejour: null, motif: 'travaux' }),
        occ({ id: 'o2', chambreId: 'ch-1', statut: 'FERME', source: 'SEJOUR' }),
      ],
    });
    const res = await service(prisma).getGrille('user-1', 'centre-1', '2027-03-01', '2027-03-31');
    expect(res.chambres[0].etat).toEqual({ type: 'ferme' });

    const prismaBlocage = mockPrisma({
      chambres: [chambresGrille[0]],
      occupations: [occ({ id: 'o1', chambreId: 'ch-1', statut: 'FERME', source: 'BLOCAGE', sejourId: null, sejour: null })],
    });
    const res2 = await service(prismaBlocage).getGrille('user-1', 'centre-1', '2027-03-01', '2027-03-31');
    expect(res2.chambres[0].etat).toEqual({ type: 'bloquee' });
  });

  it('filtre les occupations des séjours soft-supprimés (amendement 21/07) — verrouillé par le where', async () => {
    const prisma = mockPrisma({ chambres: [chambresGrille[0]] });
    await service(prisma).getGrille('user-1', 'centre-1', '2027-03-01', '2027-03-31');
    expect(prisma.occupationChambre.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ sejourId: null }, { sejour: { deletedAt: null } }],
        }),
      }),
    );
  });
});
