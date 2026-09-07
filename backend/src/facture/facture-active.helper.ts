import type { PrismaService } from '../prisma/prisma.service.js';

/**
 * B2 — une facture est « intégralement annulée » si son avoir 1-1 couvre
 * exactement son montant. Un avoir PARTIEL laisse la facture ACTIVE.
 */
export function estIntegralementAnnulee(
  f: { montantFacture: number; avoirAssocie?: { montantFacture: number } | null },
): boolean {
  return (
    !!f.avoirAssocie &&
    Math.round(Math.abs(f.avoirAssocie.montantFacture) * 100) === Math.round(f.montantFacture * 100)
  );
}

/** Factures d'un devis (types demandés) qui ne sont PAS intégralement annulées. */
export async function chargerFacturesActives(
  prisma: PrismaService,
  devisId: string,
  types: Array<'ACOMPTE' | 'SOLDE'>,
) {
  const factures = await prisma.facture.findMany({
    where: { devisId, typeFacture: { in: types } },
    include: { avoirAssocie: { select: { montantFacture: true } } },
    orderBy: { dateEmission: 'asc' },
  });
  return factures.filter((f) => !estIntegralementAnnulee(f));
}
