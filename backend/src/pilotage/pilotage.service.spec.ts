import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { PilotageService } from './pilotage.service.js';

/**
 * Les avoirs n'existent dans aucune donnée de prod : ce code ne sera jamais
 * exercé en recette — les invariants (nommage, plafond, manquants, colonne
 * Payé) sont donc verrouillés ici, Prisma et StorageService mockés.
 */

function facture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f-1',
    numero: 'FS-2026-001',
    dateEmission: new Date(2026, 2, 15),
    typeFacture: 'SOLDE',
    destinataireNom: 'Dupont Martin',
    montantHT: 100,
    montantTVA: 20,
    montantFacture: 120,
    montantVerseTotal: 0,
    pdfUrl: 'https://s3.gra.io.cloud.ovh.net/liavo/factures/f-1.pdf',
    devis: { versements: [] },
    ...overrides,
  };
}

function mockDeps(factures: unknown[]) {
  const prisma = {
    centreHebergement: {
      // getCentreForUser sans centreId → findFirst propriétaire
      findFirst: jest.fn(async () => ({ id: 'centre-1', statut: 'ACTIVE', userId: 'user-1' })),
    },
    facture: { findMany: jest.fn(async () => factures) },
  };
  const storage = {
    zipFromUrls: jest.fn(
      async (
        _entries: Array<{ nom: string; url: string }>,
        _extras: Array<{ nom: string; contenu: string | Buffer }>,
      ) => ({ buffer: Buffer.from('zip'), manquants: [] as string[] }),
    ),
  };
  const service = new PilotageService(
    prisma as unknown as PrismaService,
    storage as unknown as StorageService,
  );
  return { prisma, storage, service };
}

describe('PilotageService — export ZIP des PDF de factures', () => {
  it('nommage : facture SOLDE → YYYY-MM-DD_numero_slug-client.pdf', async () => {
    const { service, storage } = mockDeps([facture()]);

    await service.exportFacturesZip('user-1', null, '2026-01-01', '2026-12-31');

    const [entries] = storage.zipFromUrls.mock.calls[0];
    expect(entries).toEqual([
      {
        nom: '2026-03-15_FS-2026-001_Dupont-Martin.pdf',
        url: 'https://s3.gra.io.cloud.ovh.net/liavo/factures/f-1.pdf',
      },
    ]);
  });

  it('nommage : facture AVOIR → préfixe AVOIR_', async () => {
    const { service, storage } = mockDeps([
      facture({ numero: 'AV-2026-002', typeFacture: 'AVOIR', montantFacture: -120 }),
    ]);

    await service.exportFacturesZip('user-1', null, '2026-01-01', '2026-12-31');

    const [entries] = storage.zipFromUrls.mock.calls[0];
    expect(entries[0].nom).toBe('AVOIR_2026-03-15_AV-2026-002_Dupont-Martin.pdf');
  });

  it('facture avec pdfUrl null → absente du zip, listée dans _PDF_MANQUANTS.txt', async () => {
    const { service, storage } = mockDeps([
      facture(),
      facture({ id: 'f-2', numero: 'FA-2026-009', pdfUrl: null }),
    ]);

    await service.exportFacturesZip('user-1', null, '2026-01-01', '2026-12-31');

    const [entries, extras] = storage.zipFromUrls.mock.calls[0];
    expect(entries).toHaveLength(1);
    expect(entries[0].nom).toContain('FS-2026-001');

    const manquantsTxt = extras.find(e => e.nom === '_PDF_MANQUANTS.txt');
    expect(manquantsTxt).toBeDefined();
    expect(manquantsTxt!.contenu).toContain('FA-2026-009');
    // le CSV comptable est toujours embarqué
    expect(extras.some(e => e.nom === '_factures.csv')).toBe(true);
  });

  it('plafond dur : plus de 300 factures → BadRequestException, aucun zip généré', async () => {
    const beaucoup = Array.from({ length: 301 }, (_, i) =>
      facture({ id: `f-${i}`, numero: `FS-2026-${String(i).padStart(4, '0')}` }),
    );
    const { service, storage } = mockDeps(beaucoup);

    await expect(
      service.exportFacturesZip('user-1', null, '2026-01-01', '2026-12-31'),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.exportFacturesZip('user-1', null, '2026-01-01', '2026-12-31'),
    ).rejects.toThrow('Trop de factures sur cette période (301). Réduisez l\'intervalle.');
    expect(storage.zipFromUrls).not.toHaveBeenCalled();
  });

  it("CSV : ligne AVOIR → colonne Type = Avoir, colonne Payé = '—' (jamais Oui/Non)", async () => {
    const { service } = mockDeps([
      // montants négatifs : montantVerseTotal (0) >= montantFacture (-120) serait
      // "payé" avec l'ancienne comparaison — le tiret verrouille l'absence de sens.
      facture({ numero: 'AV-2026-003', typeFacture: 'AVOIR', montantHT: -100, montantTVA: -20, montantFacture: -120 }),
    ]);

    const csv = await service.exportFacturesCSV('user-1', null, '2026-01-01', '2026-12-31');

    const lignes = csv.split('\n');
    expect(lignes[0]).toContain('Date;N°;Type;Client');
    const ligneAvoir = lignes.find(l => l.includes('AV-2026-003'));
    expect(ligneAvoir).toBeDefined();
    expect(ligneAvoir).toContain(';Avoir;');
    expect(ligneAvoir!.endsWith(';—')).toBe(true);
  });
});

describe('StorageService.zipFromUrls', () => {
  function makeStorage() {
    const config = { get: jest.fn(() => 'https://s3.gra.io.cloud.ovh.net') };
    // Le constructeur S3Client n'ouvre aucune connexion — fetchAsBuffer est mocké.
    return new StorageService(config as never);
  }

  it("une URL en échec ne fait pas échouer les autres : nom dans manquants, zip complet pour le reste", async () => {
    const storage = makeStorage();
    jest.spyOn(storage, 'fetchAsBuffer').mockImplementation(async (url: string) => {
      if (url.includes('fail')) throw new Error('S3 KO');
      return Buffer.from(`contenu:${url}`);
    });

    const { buffer, manquants } = await storage.zipFromUrls(
      [
        { nom: 'a.pdf', url: 'https://ok/a' },
        { nom: 'b.pdf', url: 'https://fail/b' },
        { nom: 'c.pdf', url: 'https://ok/c' },
      ],
      [{ nom: '_index.csv', contenu: 'en-tete' }],
    );

    expect(manquants).toEqual(['b.pdf']);

    const { default: PizZip } = await import('pizzip');
    const zip = new PizZip(buffer);
    expect(Object.keys(zip.files).sort()).toEqual(['_index.csv', 'a.pdf', 'c.pdf']);
    expect(zip.file('a.pdf')!.asText()).toBe('contenu:https://ok/a');
    expect(zip.file('_index.csv')!.asText()).toBe('en-tete');
  });
});
