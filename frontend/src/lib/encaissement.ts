// Source unique de la dérivation d'encaissement (Lot 3 : partagée planning + CRM).
// SOLDE = reste dû ≤ 0,01 sur le total NET D'AVOIR ; ACOMPTE_VERSE = au moins un versement.

const round2 = (n: number) => Math.round(n * 100) / 100;

// Type structurel minimal — DevisPourCouleur (planning) et DevisClient (CRM) le satisfont.
export interface DevisEncaissable {
  statut: string;
  montantTTC?: number | null;
  montantTotal?: string | number | null;
  montantVerseTotal?: number | null;
  factures?: Array<{ typeFacture: string; montantFacture?: number }> | null;
}

export function etatEncaissement(d: DevisEncaissable): 'SOLDE' | 'ACOMPTE_VERSE' | null {
  const totalBrut = d.montantTTC ?? (d.montantTotal != null ? Number(d.montantTotal) : 0);
  const avoirs = (d.factures ?? [])
    .filter(f => f.typeFacture === 'AVOIR')
    .reduce((s, f) => s + (f.montantFacture ?? 0), 0); // négatifs
  const totalNet = round2(totalBrut + avoirs);
  const verse = d.montantVerseTotal ?? 0;
  if (totalNet > 0 && round2(totalNet - verse) <= 0.01) return 'SOLDE';
  if (verse > 0) return 'ACOMPTE_VERSE';
  return null;
}
