import type { Devis } from './devis';
import { getFactureAcompte, getFactureSolde } from './devis';

export const SEUIL_ALERTE_JOURS = 30;

/** Date de début séjour (collab → demande.sejour, direct → sejourDirect, fallback createdAt). */
export function resolveSejourDateDebut(d: Devis): string {
  return d.demande?.sejour?.dateDebut ?? d.sejourDirect?.dateDebut ?? d.createdAt;
}

/** Date de fin séjour (collab → demande.sejour, direct → sejourDirect, fallback dateDebut). */
export function resolveSejourDateFin(d: Devis): string {
  return d.demande?.sejour?.dateFin ?? d.sejourDirect?.dateFin ?? resolveSejourDateDebut(d);
}

/** Vrai si le nombre de jours écoulés depuis `iso` dépasse strictement SEUIL_ALERTE_JOURS. */
function joursDepasses(iso: string): boolean {
  const t = new Date(iso).getTime();
  if (isNaN(t)) return false;
  const diff = Date.now() - t;
  return diff > SEUIL_ALERTE_JOURS * 86400000;
}

/** Type des catégories d'alerte. */
export type CategorieAlerte =
  | 'devisARelancer'      // EN_ATTENTE / EN_ATTENTE_VALIDATION depuis > 30j
  | 'aFacturer'           // acompte à créer OU solde à créer, en alerte
  | 'acomptesARelancer'   // FA émise, non validée, > 30j
  | 'acomptesAValider'    // FA émise, non validée, <= 30j
  | 'soldesARelancer';    // FS émise, reste dû > 0, > 30j

/** Est-ce que ce devis est en alerte pour cette catégorie ? Utilisé pour bordure/pastille. */
export function estAlerte(d: Devis, cat: CategorieAlerte): boolean {
  const fa = getFactureAcompte(d);
  const fs = getFactureSolde(d);
  switch (cat) {
    case 'devisARelancer':
      return (d.statut === 'EN_ATTENTE' || d.statut === 'EN_ATTENTE_VALIDATION')
        && !fa && !fs && joursDepasses(d.createdAt);
    case 'aFacturer': {
      // Acompte à créer : SELECTIONNE / SIGNE_DIRECTION sans facture, > 30j depuis createdAt du devis
      const acompteAlerte =
        (d.statut === 'SELECTIONNE' || d.statut === 'SIGNE_DIRECTION')
        && !fa && !fs && joursDepasses(d.createdAt);
      // Solde à créer : FA validée, séjour terminé depuis > 30j, pas de FS
      const soldeAlerte =
        !!fa && !fs && joursDepasses(resolveSejourDateFin(d));
      return acompteAlerte || soldeAlerte;
    }
    case 'acomptesARelancer':
      return !!fa && !fa.acompteVerse && joursDepasses(fa.dateEmission);
    case 'acomptesAValider':
      return !!fa && !fa.acompteVerse && !joursDepasses(fa.dateEmission);
    case 'soldesARelancer':
      return !!fs
        && (fs.montantVerseTotal ?? 0) < fs.montantFacture * 0.99
        && joursDepasses(fs.dateEmission);
  }
}

export interface CompteurAlerte { count: number; ids: Set<string> }

export interface AlertesDevis {
  devisARelancer: CompteurAlerte;
  aFacturer: CompteurAlerte;
  acomptesARelancer: CompteurAlerte;
  acomptesAValider: CompteurAlerte;
  soldesARelancer: CompteurAlerte;
  total: number;
}

/** Calcule les 5 compteurs d'alerte. Un même devis peut être compté dans plusieurs catégories. */
export function computeAlertes(devis: Devis[]): AlertesDevis {
  const empty = (): CompteurAlerte => ({ count: 0, ids: new Set() });
  const a: AlertesDevis = {
    devisARelancer: empty(),
    aFacturer: empty(),
    acomptesARelancer: empty(),
    acomptesAValider: empty(),
    soldesARelancer: empty(),
    total: 0,
  };
  const cats: CategorieAlerte[] = ['devisARelancer', 'aFacturer', 'acomptesARelancer', 'acomptesAValider', 'soldesARelancer'];
  for (const d of devis) {
    for (const cat of cats) {
      if (estAlerte(d, cat)) {
        a[cat].count++;
        a[cat].ids.add(d.id);
      }
    }
  }
  a.total = a.devisARelancer.count + a.aFacturer.count + a.acomptesARelancer.count + a.acomptesAValider.count + a.soldesARelancer.count;
  return a;
}

/** Mapping catégorie → onglet cible pour cliquer depuis le bandeau. */
export const ALERTE_TO_ONGLET: Record<CategorieAlerte, string> = {
  devisARelancer:    'attente',
  aFacturer:         'a-facturer',
  acomptesARelancer: 'suivi-acomptes',
  acomptesAValider:  'suivi-acomptes',
  soldesARelancer:   'suivi-soldes',
};
