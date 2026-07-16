import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EmailService } from '../email/email.service.js';
import type { SequenceService } from '../sequence/sequence.service.js';
import type { StorageService } from '../storage/storage.service.js';
import { FactureService } from './facture.service.js';

/**
 * Tests de caractérisation du flux acompte/solde (refacto facture-solde, étape 0).
 * Ils figent le comportement OBSERVÉ ; quand une étape de la refonte change un
 * montant, le test correspondant évolue EXPLICITEMENT dans le même commit.
 * Cas couverts : docs/refacto-facture-solde.md §7.
 */

// Génération PDF : les imports DYNAMIQUES de generateAndStorePdf échouent dans la
// VM jest (ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG) et sont avalés par le
// try/catch non bloquant du service — équivalent à un no-op, voulu ici (les tests
// portent sur les MONTANTS, pas sur le rendu). On étouffe juste le bruit console.
let consoleErrorSpy: jest.SpyInstance;
beforeAll(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterAll(() => consoleErrorSpy.mockRestore());

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CENTRE = {
  id: 'centre-1',
  userId: 'user-1',
  statut: 'ACTIVE',
  organisationId: null,
  nom: 'Le Sauvageon',
  adresse: '1 chemin des Bois',
  codePostal: '74110',
  ville: 'Morzine',
  siret: null,
  tvaIntracommunautaire: null,
  email: null,
  telephone: null,
  iban: null,
  logoUrl: null,
};

function devisDirect(over: Record<string, unknown> = {}) {
  return {
    id: 'devis-1',
    centreId: 'centre-1',
    demandeId: null,
    sejourDirectId: 'sejour-1',
    statut: 'SIGNE_DIRECTION',
    isComplementaire: false,
    montantTotal: 6600,
    montantHT: 6600,
    montantTVA: 0,
    montantTTC: 6600,
    tauxTva: 0,
    pourcentageAcompte: 45,
    montantAcompte: 2970,
    conditionsAnnulation: null,
    nomEntreprise: null,
    adresseEntreprise: null,
    siretEntreprise: null,
    emailEntreprise: null,
    telEntreprise: null,
    lignes: [
      { description: 'Séjour', quantite: 1, prixUnitaire: 6600, tva: 0, totalHT: 6600, totalTTC: 6600 },
    ],
    centre: CENTRE,
    demande: null,
    sejourDirect: {
      id: 'sejour-1', titre: 'Mariage T.', clientNom: 'Test', clientPrenom: 'Client',
      clientEmail: null, clientOrganisation: null,
      clientAdresse: null, clientCodePostal: null, clientVille: null,
    },
    ...over,
  };
}

function factureAcompte(over: Record<string, unknown> = {}) {
  return {
    id: 'fa-1',
    devisId: 'devis-1',
    numero: 'FA-2026-0001',
    typeFacture: 'ACOMPTE',
    dateEmission: new Date(2026, 5, 1),
    montantTTC: 6600,
    montantFacture: 2970,
    montantVerseTotal: 0,
    acompteVerse: true,
    factureAcompteId: null,
    montantAcompteDejaFacture: null,
    ...over,
  };
}

interface Versement { id: string; devisId: string; factureId: string | null; montant: number; datePaiement: Date; reference?: string | null; modePaiement?: string | null }

interface State {
  devis: ReturnType<typeof devisDirect>;
  factureAcompte: ReturnType<typeof factureAcompte> | null;
  factureSolde: Record<string, unknown> | null;
  avoir: { montantFacture: number } | null;
  versements: Versement[];
  byId: Record<string, Record<string, unknown>>;
  created: Array<Record<string, unknown>>;
  factureUpdates: Array<{ where: { id: string }; data: Record<string, unknown> }>;
  devisUpdates: Array<Record<string, unknown>>;
  versementsCrees: Array<Record<string, unknown>>;
}

function initState(over: Partial<State> = {}): State {
  return {
    devis: devisDirect(),
    factureAcompte: factureAcompte(),
    factureSolde: null,
    avoir: null,
    versements: [],
    byId: {},
    created: [],
    factureUpdates: [],
    devisUpdates: [],
    versementsCrees: [],
    ...over,
  };
}

function mockDeps(state: State) {
  const sumVersements = (filter: (v: Versement) => boolean) =>
    state.versements.filter(filter).reduce((s, v) => s + v.montant, 0);

  const prisma = {
    centreHebergement: { findFirst: jest.fn(async () => CENTRE) },
    devis: {
      findUnique: jest.fn(async () => state.devis),
      update: jest.fn(async (args: Record<string, unknown>) => { state.devisUpdates.push(args); return state.devis; }),
    },
    organisation: { findUnique: jest.fn(async () => null) },
    facture: {
      findFirst: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.typeFacture === 'ACOMPTE') return state.factureAcompte;
        if (where.typeFacture === 'SOLDE') return state.factureSolde;
        if (where.typeFacture && (where.typeFacture as { in?: string[] }).in) {
          return state.factureAcompte ?? state.factureSolde ?? null;
        }
        return null;
      }),
      findUnique: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.factureAnnuleeId) return state.avoir;
        if (where.id) return state.byId[where.id as string] ?? null;
        return null;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => ({
        ...(state.byId[where.id] ?? {}),
        lignes: [],
        versements: state.versements.filter(v => v.factureId === where.id),
        factureAnnulee: null,
      })),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const created = { id: 'fs-new', ...data, lignes: [], versements: [] };
        state.created.push(created);
        state.byId['fs-new'] = created;
        return created;
      }),
      update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
        state.factureUpdates.push(args);
        const base = state.byId[args.where.id]
          ?? (state.factureAcompte?.id === args.where.id ? state.factureAcompte : {});
        const updated = { ...base, ...args.data, devisId: 'devis-1', lignes: [], versements: [] };
        state.byId[args.where.id] = updated as Record<string, unknown>;
        return updated;
      }),
    },
    versementPaiement: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.factureId) return state.versements.filter(v => v.factureId === where.factureId);
        if (where.devisId) return state.versements.filter(v => v.devisId === where.devisId);
        return state.versements;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: { id: { in: string[] } }; data: { factureId: string } }) => {
        for (const v of state.versements) {
          if (where.id.in.includes(v.id)) v.factureId = data.factureId;
        }
        return { count: where.id.in.length };
      }),
      aggregate: jest.fn(async ({ where }: { where: Record<string, unknown> }) => ({
        _sum: {
          montant: where.factureId
            ? sumVersements(v => v.factureId === where.factureId)
            : sumVersements(v => v.devisId === where.devisId),
        },
      })),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        state.versementsCrees.push(data);
        const v: Versement = { id: `v-new-${state.versementsCrees.length}`, ...(data as Omit<Versement, 'id'>) };
        state.versements.push(v);
        return v;
      }),
      delete: jest.fn(),
    },
    sejourClient: { findFirst: jest.fn(async () => null) },
    user: { findUnique: jest.fn(async () => ({ email: 'me@liavo.fr' })) },
  };

  const email = {
    sendGenericNotification: jest.fn(),
    sendNotifAdmin: jest.fn(),
    sendFactureParEmail: jest.fn(),
  };
  const sequence = { generer: jest.fn(async () => 1) };
  const storage = { uploadBuffer: jest.fn(async () => 'https://s3/pdf'), fetchAsBuffer: jest.fn() };

  const service = new FactureService(
    prisma as unknown as PrismaService,
    email as unknown as EmailService,
    sequence as unknown as SequenceService,
    storage as unknown as StorageService,
  );
  return { prisma, email, sequence, storage, service, state };
}

// ─── emettreAcompte ──────────────────────────────────────────────────────────

describe('emettreAcompte — montants émis', () => {
  it('montantFacture = montantAcompte du devis quand présent', async () => {
    const { service, state } = mockDeps(initState({ factureAcompte: null }));
    const f = await service.emettreAcompte('devis-1', 'user-1');
    expect(f.montantFacture).toBe(2970);
    expect(f.montantTTC).toBe(6600);
    expect(state.created).toHaveLength(1);
  });

  it('fallback : montantFacture = TTC × pourcentage quand montantAcompte absent', async () => {
    const { service } = mockDeps(initState({
      factureAcompte: null,
      devis: devisDirect({ montantAcompte: null, pourcentageAcompte: 30 }),
    }));
    const f = await service.emettreAcompte('devis-1', 'user-1');
    expect(f.montantFacture).toBe(1980); // 6600 × 30 %
  });
});

// ─── emettreFactureSolde — montants ─────────────────────────────────────────

describe('emettreFactureSolde — calcul du solde (COMPORTEMENT ACTUEL)', () => {
  it('CARACTÉRISATION DU BUG (§7.1) : déduit l\'acompte FACTURÉ même si l\'encaissé diffère', async () => {
    // Acompte facturé 2 970, encaissé 3 300 (sur-payé).
    const { service } = mockDeps(stateAcompteEncaisse(3300));
    const f = await service.emettreFactureSolde('devis-1', 'user-1');
    // ACTUEL : 6600 − 2970 (facturé) = 3630 → le client est surfacturé de 330.
    // CIBLE (étape 2) : 6600 − 3300 (encaissé) = 3300.
    expect(f.montantFacture).toBe(3630);
    expect(f.montantAcompteDejaFacture).toBe(2970); // sens ACTUEL : acompte facturé net d'avoir
    expect(f.factureAcompteId).toBe('fa-1');
  });

  it('devis révisé à la baisse (8 000 → 6 600), acompte 2 400 facturé ET encaissé → solde 4 200 (§7.2)', async () => {
    const state = initState({
      devis: devisDirect({ montantTTC: 6600, montantHT: 6600, montantTotal: 6600 }),
      factureAcompte: factureAcompte({ montantTTC: 8000, montantFacture: 2400, montantVerseTotal: 2400 }),
      versements: [
        { id: 'v1', devisId: 'devis-1', factureId: 'fa-1', montant: 2400, datePaiement: new Date(2026, 5, 2) },
      ],
    });
    const { service } = mockDeps(state);
    const f = await service.emettreFactureSolde('devis-1', 'user-1');
    expect(f.montantFacture).toBe(4200); // identique dans le modèle cible (facturé = encaissé)
  });

  it('révisé SOUS l\'acompte sans avoir → ForbiddenException (§7.2b / §7.5, à préserver)', async () => {
    const state = initState({
      devis: devisDirect({ montantTTC: 2000, montantHT: 2000, montantTotal: 2000 }),
      factureAcompte: factureAcompte({ montantFacture: 2400, montantVerseTotal: 2400 }),
      versements: [
        { id: 'v1', devisId: 'devis-1', factureId: 'fa-1', montant: 2400, datePaiement: new Date(2026, 5, 2) },
      ],
    });
    const { service } = mockDeps(state);
    await expect(service.emettreFactureSolde('devis-1', 'user-1')).rejects.toThrow(ForbiddenException);
  });

  it('avec avoir sur l\'acompte : acompte net = facturé + avoir (négatif) (§7.5)', async () => {
    const state = initState({
      devis: devisDirect({ montantTTC: 2000, montantHT: 2000, montantTotal: 2000 }),
      factureAcompte: factureAcompte({ montantFacture: 2400, montantVerseTotal: 2400 }),
      avoir: { montantFacture: -600 },
      versements: [
        { id: 'v1', devisId: 'devis-1', factureId: 'fa-1', montant: 2400, datePaiement: new Date(2026, 5, 2) },
      ],
    });
    const { service } = mockDeps(state);
    const f = await service.emettreFactureSolde('devis-1', 'user-1');
    // acompteNet = 2400 + (−600) = 1800 → solde = 2000 − 1800 = 200
    expect(f.montantFacture).toBe(200);
    expect(f.montantAcompteDejaFacture).toBe(1800);
  });

  it('trop-perçu (net > TTC révisé) → montantFacture borné à 0 (§7.7, à préserver)', async () => {
    const state = initState({
      devis: devisDirect({ montantTTC: 2000, montantHT: 2000, montantTotal: 2000 }),
      factureAcompte: factureAcompte({ montantFacture: 2400, montantVerseTotal: 2400 }),
      avoir: { montantFacture: -100 }, // net 2300 > TTC 2000
      versements: [
        { id: 'v1', devisId: 'devis-1', factureId: 'fa-1', montant: 2400, datePaiement: new Date(2026, 5, 2) },
      ],
    });
    const { service } = mockDeps(state);
    const f = await service.emettreFactureSolde('devis-1', 'user-1');
    expect(f.montantFacture).toBe(0); // max(0, 2000 − 2300)
  });

  it('gate : acompte non validé → ForbiddenException', async () => {
    const { service } = mockDeps(initState({
      factureAcompte: factureAcompte({ acompteVerse: false }),
    }));
    await expect(service.emettreFactureSolde('devis-1', 'user-1')).rejects.toThrow(ForbiddenException);
  });
});

function stateAcompteEncaisse(encaisse: number): State {
  return initState({
    factureAcompte: factureAcompte({ montantVerseTotal: encaisse }),
    versements: [
      { id: 'v1', devisId: 'devis-1', factureId: 'fa-1', montant: 1980, datePaiement: new Date(2025, 8, 24) },
      { id: 'v2', devisId: 'devis-1', factureId: 'fa-1', montant: encaisse - 1980, datePaiement: new Date(2026, 2, 23) },
    ],
  });
}

// ─── Re-balance (COMPORTEMENT ACTUEL — supprimée à l'étape 5) ────────────────

describe('emettreFactureSolde — re-balance des versements (COMPORTEMENT ACTUEL)', () => {
  it('acompte sur-payé en 3 versements : le versement en overflow est DÉPLACÉ vers le solde (§7.4)', async () => {
    // Facturé 2 970 ; versements 1 980 + 1 320 + 500. Parcours par date :
    // v1 (cumul 0 < 2970, reste) → v2 (cumul 1980 < 2970, reste) → v3 (cumul 3300 ≥ 2970, DÉPLACÉ).
    const state = initState({
      factureAcompte: factureAcompte({ montantVerseTotal: 3800 }),
      versements: [
        { id: 'v1', devisId: 'devis-1', factureId: 'fa-1', montant: 1980, datePaiement: new Date(2025, 8, 24) },
        { id: 'v2', devisId: 'devis-1', factureId: 'fa-1', montant: 1320, datePaiement: new Date(2026, 2, 23) },
        { id: 'v3', devisId: 'devis-1', factureId: 'fa-1', montant: 500, datePaiement: new Date(2026, 6, 16) },
      ],
    });
    const { service, prisma } = mockDeps(state);
    await service.emettreFactureSolde('devis-1', 'user-1');
    expect(prisma.versementPaiement.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['v3'] } },
      data: { factureId: 'fs-new' },
    });
    expect(state.versements.find(v => v.id === 'v3')?.factureId).toBe('fs-new');
    expect(state.versements.filter(v => v.factureId === 'fa-1').map(v => v.id)).toEqual(['v1', 'v2']);
  });

  it('versement à cheval sur la frontière : NON scindé, reste entier sur l\'acompte', async () => {
    // v1 1980 (cumul 0 < 2970, reste) → v2 1320 (cumul 1980 < 2970, reste ENTIER malgré le dépassement).
    const { service, prisma } = mockDeps(stateAcompteEncaisse(3300));
    await service.emettreFactureSolde('devis-1', 'user-1');
    expect(prisma.versementPaiement.updateMany).not.toHaveBeenCalled();
    expect(state3300AllOnAcompte(prisma)).toBe(true);
  });
});

function state3300AllOnAcompte(prisma: { versementPaiement: { updateMany: jest.Mock } }): boolean {
  return prisma.versementPaiement.updateMany.mock.calls.length === 0;
}

// ─── emettreFactureTotal ─────────────────────────────────────────────────────

describe('emettreFactureTotal (§7.6)', () => {
  it('montantFacture = TTC, pas d\'acompte lié', async () => {
    const { service } = mockDeps(initState({ factureAcompte: null }));
    const f = await service.emettreFactureTotal('devis-1', 'user-1');
    expect(f.montantFacture).toBe(6600);
    expect(f.montantAcompteDejaFacture).toBe(0);
    expect(f.factureAcompteId).toBeNull();
  });

  it('refusée si une facture existe déjà', async () => {
    const { service } = mockDeps(initState());
    await expect(service.emettreFactureTotal('devis-1', 'user-1')).rejects.toThrow(ForbiddenException);
  });
});

// ─── validerAcompte ──────────────────────────────────────────────────────────

describe('validerAcompte (COMPORTEMENT ACTUEL — auto-versement ajouté à l\'étape 2)', () => {
  function stateValidation(versements: Versement[]): State {
    const fa = factureAcompte({
      acompteVerse: false,
      montantVerseTotal: versements.reduce((s, v) => s + v.montant, 0),
    });
    const state = initState({ factureAcompte: fa, versements });
    state.byId['fa-1'] = {
      ...fa,
      devis: {
        id: 'devis-1', centreId: 'centre-1', demandeId: null, sejourDirectId: 'sejour-1',
        centre: { ...CENTRE, user: { email: 'heb@liavo.fr' } },
        demande: null,
        sejourDirect: { titre: 'Mariage T.' },
      },
    };
    return state;
  }

  it('pose acompteVerse=true SANS créer de versement (§7.3 — comportement actuel)', async () => {
    const state = stateValidation([]);
    const { service, state: s } = mockDeps(state);
    const updated = await service.validerAcompte('fa-1', { id: 'user-1', role: 'HEBERGEUR' });
    expect(updated.acompteVerse).toBe(true);
    expect(s.versementsCrees).toHaveLength(0); // ← le trou caractérisé : encaissé reste 0
  });

  it('refuse une double validation', async () => {
    const state = stateValidation([]);
    state.byId['fa-1'] = { ...(state.byId['fa-1'] as Record<string, unknown>), acompteVerse: true };
    const { service } = mockDeps(state);
    await expect(service.validerAcompte('fa-1', { id: 'user-1', role: 'HEBERGEUR' })).rejects.toThrow(ForbiddenException);
  });
});

// ─── UBL Chorus ──────────────────────────────────────────────────────────────

describe('getChorusXml — Prepaid / PayableAmount (§7.8)', () => {
  function stateChorus(factureFields: Record<string, unknown>): State {
    const state = initState();
    state.byId['f-x'] = {
      id: 'f-x',
      numero: 'FS-2026-0002',
      typeFacture: 'SOLDE',
      dateEmission: new Date(2026, 6, 1),
      emetteurNom: 'Le Sauvageon',
      emetteurAdresse: null,
      emetteurTva: null,
      emetteurSiret: null,
      destinataireNom: 'Client',
      destinataireAdresse: null,
      destinataireSiret: null,
      montantHT: 6600,
      montantTVA: 0,
      montantTTC: 6600,
      tauxTva: 0,
      lignes: [{ description: 'Séjour', quantite: 1, prixUnitaire: 6600, tva: 0, totalHT: 6600, totalTTC: 6600 }],
      devis: { centreId: 'centre-1', demandeId: null, sejourDirectId: 'sejour-1', centre: { mandatFacturationAccepte: true } },
      ...factureFields,
    };
    return state;
  }

  it('SOLDE : Prepaid = montantAcompteDejaFacture, Payable = montantFacture (champs figés)', async () => {
    const { service } = mockDeps(stateChorus({ montantFacture: 3630, montantAcompteDejaFacture: 2970 }));
    const { xml } = await service.getChorusXml('f-x', { id: 'user-1', role: 'HEBERGEUR' });
    expect(xml).toContain('<cbc:PrepaidAmount currencyID="EUR">2970.00</cbc:PrepaidAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">3630.00</cbc:PayableAmount>');
  });

  it('ACOMPTE : Prepaid = 0, Payable = montantFacture', async () => {
    const { service } = mockDeps(stateChorus({
      typeFacture: 'ACOMPTE', numero: 'FA-2026-0002',
      montantFacture: 2970, montantAcompteDejaFacture: null,
    }));
    const { xml } = await service.getChorusXml('f-x', { id: 'user-1', role: 'HEBERGEUR' });
    expect(xml).toContain('<cbc:PrepaidAmount currencyID="EUR">0.00</cbc:PrepaidAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">2970.00</cbc:PayableAmount>');
  });
});
