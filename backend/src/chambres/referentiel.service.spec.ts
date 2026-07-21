import { NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { PrismaService } from '../prisma/prisma.service.js';
import { ReferentielService } from './referentiel.service.js';
import { CreateChambreDto } from './dto/create-chambre.dto.js';
import { CreateLitDto } from './dto/create-lit.dto.js';
import { AjouterLitsDto } from './dto/ajouter-lits.dto.js';

/**
 * Référentiel chambres/lits (sous-chantier 3), Prisma mocké — pattern
 * capacite.service.spec.ts. Invariants verrouillés : capacité = Σ lits.places
 * dérivée au mapping (jamais stockée), défauts de places par type
 * (SUPERPOSE/DOUBLE → 2, sinon 1), DELETE hard si zéro occupation sinon
 * actif=false (réponse explicite), duplication lits copiés + suffixe
 * anti-collision, cloisonnement (id + centreId) → 404, plafond places = 6
 * avec message dortoir.
 */

function lit(id: string, type: string, places: number, ordre = 0) {
  return { id, type, places, libelle: null, ordre };
}

function chambre(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ch-1',
    centreId: 'centre-1',
    nom: 'Chambre 12',
    etage: 'RDC',
    ordre: 0,
    notes: null,
    actif: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    lits: [] as unknown[],
    ...overrides,
  };
}

function mockPrisma({
  chambres = [] as unknown[],
  chambreTrouvee = null as Record<string, unknown> | null,
  litTrouve = null as Record<string, unknown> | null,
  occupations = 0,
} = {}) {
  let seq = 0;
  const echoCreate = async ({ data }: { data: Record<string, any> }) => ({
    id: `new-${++seq}`,
    centreId: data.centreId,
    nom: data.nom,
    etage: data.etage ?? null,
    ordre: data.ordre ?? 0,
    notes: data.notes ?? null,
    actif: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    lits: (data.lits?.create ?? []).map((l: Record<string, unknown>, i: number) => ({
      id: `lit-new-${i}`,
      libelle: null,
      ...l,
    })),
  });
  const prisma = {
    centreHebergement: {
      // getCentreForUser avec centreId explicite → findUnique, propriétaire = user-1
      findUnique: jest.fn(async () => ({
        id: 'centre-1',
        userId: 'user-1',
        statut: 'ACTIVE',
        capacite: 120,
      })),
    },
    chambre: {
      findMany: jest.fn(async ({ select }: { select?: unknown } = {}) =>
        select ? (chambres as Array<{ nom: string }>).map((c) => ({ nom: c.nom })) : chambres,
      ),
      findFirst: jest.fn(async () => chambreTrouvee),
      create: jest.fn(echoCreate),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...chambre(),
        id: where.id,
        ...data,
        lits: (chambreTrouvee?.lits as unknown[]) ?? [],
      })),
      delete: jest.fn(async () => chambreTrouvee),
    },
    lit: {
      findFirst: jest.fn(async () => litTrouve),
      createMany: jest.fn(async () => ({ count: 1 })),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
        ...litTrouve,
        id: where.id,
        ...data,
      })),
      delete: jest.fn(async () => litTrouve),
    },
    occupationChambre: { count: jest.fn(async () => occupations) },
    $transaction: jest.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
  return { prisma: prisma as unknown as PrismaService, mocks: prisma };
}

const svc = (deps: ReturnType<typeof mockPrisma>) => new ReferentielService(deps.prisma);

describe('ReferentielService — liste et capacité dérivée', () => {
  it('capacite = Σ lits.places (superposé 2 + simple 1 → 3), chambre sans lits → 0', async () => {
    const deps = mockPrisma({
      chambres: [
        chambre({ lits: [lit('l-1', 'SUPERPOSE', 2), lit('l-2', 'SIMPLE', 1, 1)] }),
        chambre({ id: 'ch-2', nom: 'Vide', lits: [] }),
      ],
    });
    const res = await svc(deps).getChambres('user-1', 'centre-1');
    expect(res[0].capacite).toBe(3);
    expect(res[1].capacite).toBe(0);
    // La capacité n'est jamais un champ stocké : elle n'existe que sur le mapping.
    expect(res[0]).not.toHaveProperty('centreId');
  });

  it('actives seules par défaut, inactives incluses sur demande ; tri étage/ordre/nom cloisonné centre', async () => {
    const deps = mockPrisma({ chambres: [] });
    await svc(deps).getChambres('user-1', 'centre-1');
    await svc(deps).getChambres('user-1', 'centre-1', true);
    const [defaut, avecInactives] = (deps.mocks.chambre.findMany as jest.Mock).mock.calls;
    expect(defaut[0].where).toEqual({ centreId: 'centre-1', actif: true });
    expect(avecInactives[0].where).toEqual({ centreId: 'centre-1' });
    expect(defaut[0].orderBy).toEqual([
      { etage: { sort: 'asc', nulls: 'first' } },
      { ordre: 'asc' },
      { nom: 'asc' },
    ]);
  });
});

describe('ReferentielService — création et saisie rapide', () => {
  it('création avec lits inline : défauts de places par type (SUPERPOSE → 2, APPOINT → 1)', async () => {
    const deps = mockPrisma();
    const res = await svc(deps).createChambre(
      { nom: 'Dortoir Nord', lits: [{ type: 'SUPERPOSE' }, { type: 'APPOINT' }, { type: 'DOUBLE', places: 3 }] } as CreateChambreDto,
      'user-1',
      'centre-1',
    );
    const created = (deps.mocks.chambre.create as jest.Mock).mock.calls[0][0].data.lits.create;
    expect(created.map((l: { places: number }) => l.places)).toEqual([2, 1, 3]); // explicite respecté
    expect(created.map((l: { ordre: number }) => l.ordre)).toEqual([0, 1, 2]); // ordre = index par défaut
    expect(res.capacite).toBe(6);
  });

  it('batch append : les nouveaux lits prennent l\'ordre après le max existant', async () => {
    const deps = mockPrisma({
      chambreTrouvee: chambre({ lits: [lit('l-1', 'SIMPLE', 1, 0), lit('l-2', 'SIMPLE', 1, 4)] }),
    });
    await svc(deps).ajouterLits('ch-1', [{ type: 'SUPERPOSE' }, { type: 'SIMPLE' }] as CreateLitDto[], 'user-1', 'centre-1');
    const rows = (deps.mocks.lit.createMany as jest.Mock).mock.calls[0][0].data;
    expect(rows.map((r: { ordre: number }) => r.ordre)).toEqual([5, 6]); // après max ordre 4
    expect(rows[0].places).toBe(2); // défaut SUPERPOSE
  });
});

describe('ReferentielService — duplication', () => {
  it('copie chambre + TOUS ses lits, suffixe « (copie) », collision → « (copie 2) », ×N', async () => {
    const source = chambre({ lits: [lit('l-1', 'SUPERPOSE', 2), lit('l-2', 'SIMPLE', 1, 1)] });
    const deps = mockPrisma({
      chambreTrouvee: source,
      chambres: [source, chambre({ id: 'ch-x', nom: 'Chambre 12 (copie)' })], // collision préexistante
    });
    const copies = await svc(deps).dupliquerChambre('ch-1', 3, 'user-1', 'centre-1');
    expect(copies).toHaveLength(3);
    expect(copies.map((c) => c.nom)).toEqual([
      'Chambre 12 (copie 2)',
      'Chambre 12 (copie 3)',
      'Chambre 12 (copie 4)',
    ]);
    // Lits copiés (type + places), capacité identique à la source
    for (const c of copies) expect(c.capacite).toBe(3);
    expect((deps.mocks.$transaction as jest.Mock)).toHaveBeenCalledTimes(1);
  });
});

describe('ReferentielService — DELETE chambre (un geste, le service choisit)', () => {
  it('zéro occupation → hard delete, réponse { deleted: true }', async () => {
    const deps = mockPrisma({ chambreTrouvee: chambre(), occupations: 0 });
    const res = await svc(deps).deleteChambre('ch-1', 'user-1', 'centre-1');
    expect(res).toEqual({ deleted: true });
    expect(deps.mocks.chambre.delete).toHaveBeenCalledWith({ where: { id: 'ch-1' } });
    expect(deps.mocks.chambre.update).not.toHaveBeenCalled();
  });

  it('occupations présentes → actif=false, réponse { deactivated: true }, jamais de delete', async () => {
    const deps = mockPrisma({ chambreTrouvee: chambre(), occupations: 2 });
    const res = await svc(deps).deleteChambre('ch-1', 'user-1', 'centre-1');
    expect(res).toEqual({ deactivated: true });
    expect(deps.mocks.chambre.delete).not.toHaveBeenCalled();
    expect((deps.mocks.chambre.update as jest.Mock).mock.calls[0][0].data).toEqual({ actif: false });
  });
});

describe('ReferentielService — update chambre (etage/ordre de premier rang)', () => {
  it('PATCH transmet etage et ordre ; etage null retire l\'étiquette ; actif toggle', async () => {
    const deps = mockPrisma({ chambreTrouvee: chambre() });
    await svc(deps).updateChambre('ch-1', { etage: '1er', ordre: 7 }, 'user-1', 'centre-1');
    expect((deps.mocks.chambre.update as jest.Mock).mock.calls[0][0].data).toEqual({ etage: '1er', ordre: 7 });

    await svc(deps).updateChambre('ch-1', { etage: null, actif: false }, 'user-1', 'centre-1');
    expect((deps.mocks.chambre.update as jest.Mock).mock.calls[1][0].data).toEqual({ etage: null, actif: false });
  });
});

describe('ReferentielService — cloisonnement multi-centre', () => {
  it('chambre d\'un autre centre (findFirst id+centreId → null) → NotFound, pour toutes les routes chambre', async () => {
    const deps = mockPrisma({ chambreTrouvee: null });
    const s = svc(deps);
    await expect(s.updateChambre('ch-autre', { nom: 'X' }, 'user-1', 'centre-1')).rejects.toThrow(NotFoundException);
    await expect(s.deleteChambre('ch-autre', 'user-1', 'centre-1')).rejects.toThrow(NotFoundException);
    await expect(s.dupliquerChambre('ch-autre', 1, 'user-1', 'centre-1')).rejects.toThrow(NotFoundException);
    await expect(s.ajouterLits('ch-autre', [{ type: 'SIMPLE' }] as CreateLitDto[], 'user-1', 'centre-1')).rejects.toThrow(NotFoundException);
    // Le filtre porte bien id ET centreId (jamais l'id seul)
    for (const [args] of (deps.mocks.chambre.findFirst as jest.Mock).mock.calls) {
      expect(args.where).toMatchObject({ id: 'ch-autre', centreId: 'centre-1' });
    }
  });

  it('lit d\'un autre centre → NotFound (résolu via chambre.centreId)', async () => {
    const deps = mockPrisma({ litTrouve: null });
    await expect(svc(deps).updateLit('l-autre', { places: 2 }, 'user-1', 'centre-1')).rejects.toThrow(NotFoundException);
    await expect(svc(deps).deleteLit('l-autre', 'user-1', 'centre-1')).rejects.toThrow(NotFoundException);
    expect((deps.mocks.lit.findFirst as jest.Mock).mock.calls[0][0].where).toEqual({
      id: 'l-autre',
      chambre: { centreId: 'centre-1' },
    });
  });
});

describe('DTOs — validation class-validator', () => {
  const litDto = (v: Record<string, unknown>) => plainToInstance(CreateLitDto, v);

  it('type de lit hors {SIMPLE, SUPERPOSE, TIROIR, DOUBLE, BB, APPOINT} → rejeté', async () => {
    expect(await validate(litDto({ type: 'KING_SIZE' }))).not.toHaveLength(0);
    expect(await validate(litDto({ type: 'SUPERPOSE' }))).toHaveLength(0);
  });

  it('places 7 → rejeté avec le message dortoir exact ; places 0 → rejeté', async () => {
    const erreurs = await validate(litDto({ type: 'SIMPLE', places: 7 }));
    expect(erreurs).toHaveLength(1);
    expect(erreurs[0].constraints?.max).toBe(
      'un lit ne peut excéder 6 places — pour un dortoir, créez plusieurs lits',
    );
    expect(await validate(litDto({ type: 'SIMPLE', places: 0 }))).not.toHaveLength(0);
    expect(await validate(litDto({ type: 'SIMPLE', places: 6 }))).toHaveLength(0);
  });

  it('chambre sans nom → rejetée ; batch lits vide → rejeté (ArrayMinSize)', async () => {
    expect(await validate(plainToInstance(CreateChambreDto, {}))).not.toHaveLength(0);
    expect(await validate(plainToInstance(AjouterLitsDto, { lits: [] }))).not.toHaveLength(0);
    // Et le nested valide bien chaque lit du batch
    const nested = await validate(plainToInstance(AjouterLitsDto, { lits: [{ type: 'INVALIDE' }] }));
    expect(nested).not.toHaveLength(0);
  });
});
