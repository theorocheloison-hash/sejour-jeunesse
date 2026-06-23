// ─────────────────────────────────────────────────────────────────────────────
// Calendrier France — jours fériés + vacances scolaires (données embarquées)
//
// Aucune dépendance externe, aucun fetch. Les jours fériés sont calculés
// algorithmiquement (valides pour n'importe quelle année). Les vacances scolaires
// sont hardcodées à partir des données officielles (2025-2027, toutes zones).
// ─────────────────────────────────────────────────────────────────────────────

// ─── Helpers date ────────────────────────────────────────────────────────────

/** Formate une Date locale en 'YYYY-MM-DD' (sans conversion UTC). */
function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Retourne une nouvelle Date décalée de n jours. */
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Dimanche de Pâques — algorithme de Meeus/Jones/Butcher (Anonymous Gregorian). */
function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

// ─── Jours fériés ────────────────────────────────────────────────────────────

/** Les 11 jours fériés FR métropole pour une année donnée : { 'YYYY-MM-DD': 'Nom' }. */
export function getJoursFeries(annee: number): Record<string, string> {
  const easter = getEasterDate(annee);
  return {
    [`${annee}-01-01`]: "Jour de l'an",
    [fmt(addDays(easter, 1))]: 'Lundi de Pâques',
    [`${annee}-05-01`]: 'Fête du Travail',
    [`${annee}-05-08`]: 'Victoire 1945',
    [fmt(addDays(easter, 39))]: 'Ascension',
    [fmt(addDays(easter, 50))]: 'Pentecôte',
    [`${annee}-07-14`]: 'Fête Nationale',
    [`${annee}-08-15`]: 'Assomption',
    [`${annee}-11-01`]: 'Toussaint',
    [`${annee}-11-11`]: 'Armistice',
    [`${annee}-12-25`]: 'Noël',
  };
}

const feriesCache: Record<number, Record<string, string>> = {};

/** Retourne le nom du jour férié pour une date 'YYYY-MM-DD', ou null. */
export function getJourFerie(dateStr: string): string | null {
  const annee = Number(dateStr.slice(0, 4));
  if (!feriesCache[annee]) feriesCache[annee] = getJoursFeries(annee);
  return feriesCache[annee][dateStr] ?? null;
}

// ─── Vacances scolaires ──────────────────────────────────────────────────────

export interface PeriodeVacances {
  nom: string;
  zones: string; // 'ABC', 'A', 'B', 'C', 'AB', 'AC', 'BC'
  debut: string; // 'YYYY-MM-DD' (samedi de départ)
  fin: string;   // 'YYYY-MM-DD' (lundi de reprise, exclu)
}

export const VACANCES_SCOLAIRES: PeriodeVacances[] = [
  // ── 2025-2026 ──
  { nom: 'Toussaint',  zones: 'ABC', debut: '2025-10-18', fin: '2025-11-03' },
  { nom: 'Noël',       zones: 'ABC', debut: '2025-12-20', fin: '2026-01-05' },
  { nom: 'Hiver',      zones: 'A',   debut: '2026-02-07', fin: '2026-02-23' },
  { nom: 'Hiver',      zones: 'B',   debut: '2026-02-14', fin: '2026-03-02' },
  { nom: 'Hiver',      zones: 'C',   debut: '2026-02-21', fin: '2026-03-09' },
  { nom: 'Printemps',  zones: 'A',   debut: '2026-04-04', fin: '2026-04-20' },
  { nom: 'Printemps',  zones: 'B',   debut: '2026-04-11', fin: '2026-04-27' },
  { nom: 'Printemps',  zones: 'C',   debut: '2026-04-18', fin: '2026-05-04' },
  { nom: 'Ascension',  zones: 'ABC', debut: '2026-05-13', fin: '2026-05-18' },
  { nom: 'Été',        zones: 'ABC', debut: '2026-07-04', fin: '2026-09-01' },

  // ── 2026-2027 ──
  { nom: 'Toussaint',  zones: 'ABC', debut: '2026-10-17', fin: '2026-11-02' },
  { nom: 'Noël',       zones: 'ABC', debut: '2026-12-19', fin: '2027-01-04' },
  { nom: 'Hiver',      zones: 'C',   debut: '2027-02-06', fin: '2027-02-22' },
  { nom: 'Hiver',      zones: 'A',   debut: '2027-02-13', fin: '2027-03-01' },
  { nom: 'Hiver',      zones: 'B',   debut: '2027-02-20', fin: '2027-03-08' },
  { nom: 'Printemps',  zones: 'C',   debut: '2027-04-03', fin: '2027-04-19' },
  { nom: 'Printemps',  zones: 'A',   debut: '2027-04-10', fin: '2027-04-26' },
  { nom: 'Printemps',  zones: 'B',   debut: '2027-04-17', fin: '2027-05-03' },
  { nom: 'Ascension',  zones: 'ABC', debut: '2027-05-05', fin: '2027-05-10' },
  { nom: 'Été',        zones: 'ABC', debut: '2027-07-03', fin: '2027-09-01' },
];

/**
 * Retourne la période de vacances couvrant une date 'YYYY-MM-DD', avec les zones
 * fusionnées (ex: si Zone A et Zone B couvrent ce jour → 'A+B'), ou null.
 * Borne incluse au début, exclue à la fin (le lundi de reprise n'est pas vacances).
 */
export function getVacancesZones(dateStr: string): { nom: string; zones: string } | null {
  // Comparaison lexicographique valide sur le format 'YYYY-MM-DD'.
  const matches = VACANCES_SCOLAIRES.filter(p => dateStr >= p.debut && dateStr < p.fin);
  if (matches.length === 0) return null;

  const zonesSet = new Set<string>();
  matches.forEach(p => p.zones.split('').forEach(z => zonesSet.add(z)));
  const zones = ['A', 'B', 'C'].filter(z => zonesSet.has(z)).join('+');

  const noms = Array.from(new Set(matches.map(p => p.nom)));
  const nom = noms.length === 1 ? noms[0] : noms.join(' / ');

  return { nom, zones };
}

// ─── Alerte admin — données bientôt expirées ─────────────────────────────────

/** Dernière date couverte par les données de vacances hardcodées. */
export const VACANCES_DATA_FIN = '2027-09-01';

/** Nombre de mois avant VACANCES_DATA_FIN à partir duquel on alerte l'admin. */
const SEUIL_ALERTE_MOIS = 6;

/**
 * Indique si les données de calendrier (vacances scolaires) sont périmées ou sur
 * le point de l'être (moins de SEUIL_ALERTE_MOIS avant VACANCES_DATA_FIN).
 * Sert à afficher un bandeau de maintenance côté admin pour penser à mettre à jour
 * VACANCES_SCOLAIRES.
 */
export function isCalendrierPerime(ref: Date = new Date()): boolean {
  const fin = new Date(VACANCES_DATA_FIN + 'T00:00:00');
  const seuil = new Date(fin);
  seuil.setMonth(seuil.getMonth() - SEUIL_ALERTE_MOIS);
  return ref >= seuil;
}
