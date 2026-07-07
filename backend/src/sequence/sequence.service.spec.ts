import type { PrismaService } from '../prisma/prisma.service';
import { SequenceService } from './sequence.service';

/**
 * Mock stateful du compteur : reproduit la sémantique de l'upsert Prisma
 * (create dernierNumero=1, update increment=1) scopée sur la clé composite
 * (emetteurId, annee, typeDoc) — permet de vérifier l'isolation des scopes
 * et la monotonie stricte sans base réelle.
 */
function mockPrismaSequence() {
  const compteurs = new Map<string, number>();

  const upsert = jest.fn(async ({ where }: any) => {
    const { emetteurId, annee, typeDoc } = where.emetteurId_annee_typeDoc;
    const key = `${emetteurId}|${annee}|${typeDoc}`;
    const next = (compteurs.get(key) ?? 0) + 1;
    compteurs.set(key, next);
    return { dernierNumero: next };
  });

  const findUnique = jest.fn(async ({ where }: any) => {
    const { emetteurId, annee, typeDoc } = where.emetteurId_annee_typeDoc;
    const val = compteurs.get(`${emetteurId}|${annee}|${typeDoc}`);
    return val === undefined ? null : { dernierNumero: val };
  });

  const tx = { sequenceNumero: { upsert } };
  const $transaction = jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx));

  return { prisma: { $transaction, sequenceNumero: { findUnique, upsert } }, upsert, findUnique, $transaction, compteurs };
}

describe('SequenceService', () => {
  const ANNEE = new Date().getFullYear();

  describe('generer', () => {
    it('démarre à 1 puis incrémente strictement (jamais de décrément)', async () => {
      const { prisma } = mockPrismaSequence();
      const service = new SequenceService(prisma as unknown as PrismaService);

      const numeros: number[] = [];
      for (let i = 0; i < 5; i++) {
        numeros.push(await service.generer('emetteur-1', 'FACTURE'));
      }
      expect(numeros).toEqual([1, 2, 3, 4, 5]);
    });

    it('upsert scopé sur la clé composite (emetteurId, année COURANTE, typeDoc)', async () => {
      const { prisma, upsert } = mockPrismaSequence();
      const service = new SequenceService(prisma as unknown as PrismaService);

      await service.generer('emetteur-1', 'DEVIS');

      expect(upsert).toHaveBeenCalledWith({
        where: {
          emetteurId_annee_typeDoc: { emetteurId: 'emetteur-1', annee: ANNEE, typeDoc: 'DEVIS' },
        },
        create: { emetteurId: 'emetteur-1', annee: ANNEE, typeDoc: 'DEVIS', dernierNumero: 1 },
        update: { dernierNumero: { increment: 1 } },
      });
    });

    it('l’update est un INCREMENT de 1 — structurellement aucun décrément possible', async () => {
      const { prisma, upsert } = mockPrismaSequence();
      const service = new SequenceService(prisma as unknown as PrismaService);

      await service.generer('emetteur-1', 'FACTURE');
      await service.generer('emetteur-1', 'FACTURE');

      for (const call of upsert.mock.calls) {
        expect(call[0].update).toEqual({ dernierNumero: { increment: 1 } });
        expect(call[0].create.dernierNumero).toBe(1);
      }
    });

    it('scopes indépendants : émetteurs différents ont chacun leur séquence', async () => {
      const { prisma } = mockPrismaSequence();
      const service = new SequenceService(prisma as unknown as PrismaService);

      expect(await service.generer('emetteur-A', 'FACTURE')).toBe(1);
      expect(await service.generer('emetteur-A', 'FACTURE')).toBe(2);
      expect(await service.generer('emetteur-B', 'FACTURE')).toBe(1);
    });

    it('scopes indépendants : types de document différents pour un même émetteur', async () => {
      const { prisma } = mockPrismaSequence();
      const service = new SequenceService(prisma as unknown as PrismaService);

      expect(await service.generer('emetteur-1', 'DEVIS')).toBe(1);
      expect(await service.generer('emetteur-1', 'FACTURE')).toBe(1);
      expect(await service.generer('emetteur-1', 'AVOIR')).toBe(1);
      expect(await service.generer('emetteur-1', 'DEVIS')).toBe(2);
    });

    it('collision P2002 (create concurrent) → un seul retry, le numéro est rendu', async () => {
      const { prisma, $transaction } = mockPrismaSequence();
      $transaction.mockRejectedValueOnce({ code: 'P2002' });
      const service = new SequenceService(prisma as unknown as PrismaService);

      await expect(service.generer('emetteur-1', 'FACTURE')).resolves.toBe(1);
      expect($transaction).toHaveBeenCalledTimes(2);
    });

    it('toute autre erreur est propagée sans retry', async () => {
      const { prisma, $transaction } = mockPrismaSequence();
      $transaction.mockRejectedValueOnce(new Error('connexion perdue'));
      const service = new SequenceService(prisma as unknown as PrismaService);

      await expect(service.generer('emetteur-1', 'FACTURE')).rejects.toThrow('connexion perdue');
      expect($transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('apercu', () => {
    it('compteur inexistant → prochain numéro = 1', async () => {
      const { prisma } = mockPrismaSequence();
      const service = new SequenceService(prisma as unknown as PrismaService);

      await expect(service.apercu('emetteur-1', 'FACTURE')).resolves.toBe(1);
    });

    it('retourne dernierNumero + 1 sans consommer', async () => {
      const { prisma } = mockPrismaSequence();
      const service = new SequenceService(prisma as unknown as PrismaService);

      await service.generer('emetteur-1', 'FACTURE'); // → 1
      await expect(service.apercu('emetteur-1', 'FACTURE')).resolves.toBe(2);
    });

    it('NE CONSOMME PAS : lecture seule, aucun upsert, aucune transaction', async () => {
      const { prisma, upsert, $transaction } = mockPrismaSequence();
      const service = new SequenceService(prisma as unknown as PrismaService);

      await service.apercu('emetteur-1', 'FACTURE');
      await service.apercu('emetteur-1', 'FACTURE');
      await service.apercu('emetteur-1', 'FACTURE');

      expect(upsert).not.toHaveBeenCalled();
      expect($transaction).not.toHaveBeenCalled();
    });

    it('apercu répété reste stable, puis generer attribue exactement ce numéro', async () => {
      const { prisma } = mockPrismaSequence();
      const service = new SequenceService(prisma as unknown as PrismaService);

      await service.generer('emetteur-1', 'DEVIS'); // → 1
      const a1 = await service.apercu('emetteur-1', 'DEVIS');
      const a2 = await service.apercu('emetteur-1', 'DEVIS');
      expect(a1).toBe(2);
      expect(a2).toBe(2); // pas de dérive : l'aperçu n'a rien incrémenté
      await expect(service.generer('emetteur-1', 'DEVIS')).resolves.toBe(2);
    });

    it('lit la même clé composite (émetteur, année courante, typeDoc)', async () => {
      const { prisma, findUnique } = mockPrismaSequence();
      const service = new SequenceService(prisma as unknown as PrismaService);

      await service.apercu('emetteur-1', 'AVOIR');

      expect(findUnique).toHaveBeenCalledWith({
        where: {
          emetteurId_annee_typeDoc: { emetteurId: 'emetteur-1', annee: ANNEE, typeDoc: 'AVOIR' },
        },
        select: { dernierNumero: true },
      });
    });
  });
});
