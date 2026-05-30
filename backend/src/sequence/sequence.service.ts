import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

/**
 * Génère des numéros séquentiels atomiques par émetteur et type de document.
 * Partagé entre DevisService (typeDoc='DEVIS') et FactureService (typeDoc='FACTURE').
 * typeDoc 'FACTURE' couvre acompte ET solde (numérotation continue) — Lot 0.
 */
@Injectable()
export class SequenceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Incrémente atomiquement le compteur (emetteurId, annee courante, typeDoc) et
   * retourne la valeur consommée. Retry simple sur collision P2002 (create concurrent).
   */
  async generer(emetteurId: string, typeDoc: 'DEVIS' | 'FACTURE'): Promise<number> {
    const annee = new Date().getFullYear();

    const consommer = () =>
      this.prisma.$transaction(async (tx) => {
        const seq = await tx.sequenceNumero.upsert({
          where: { emetteurId_annee_typeDoc: { emetteurId, annee, typeDoc } },
          create: { emetteurId, annee, typeDoc, dernierNumero: 1 },
          update: { dernierNumero: { increment: 1 } },
        });
        return seq.dernierNumero;
      });

    try {
      return await consommer();
    } catch (e: unknown) {
      // P2002 : collision sur un create concurrent → la ligne existe désormais, on réessaie (update)
      if (typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') {
        return consommer();
      }
      throw e;
    }
  }

  /**
   * Aperçu du prochain numéro — LECTURE SEULE, ne consomme PAS le compteur.
   * Le numéro réel est attribué par generer() au moment de la création.
   */
  async apercu(emetteurId: string, typeDoc: 'DEVIS' | 'FACTURE'): Promise<number> {
    const annee = new Date().getFullYear();
    const seq = await this.prisma.sequenceNumero.findUnique({
      where: { emetteurId_annee_typeDoc: { emetteurId, annee, typeDoc } },
      select: { dernierNumero: true },
    });
    return (seq?.dernierNumero ?? 0) + 1;
  }
}
