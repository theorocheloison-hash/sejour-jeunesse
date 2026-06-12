// Normalisation des départements à l'écriture : les centres importés (APIDAE/scraping)
// stockaient tantôt le NOM ("Haute-Savoie"), tantôt le CODE ("74"). On normalise tout
// vers le CODE INSEE pour que findOpen() (codes des demandes) matche les centres.

/**
 * Table nom → code. Clés en forme canonique (minuscule, sans accent, espaces et
 * apostrophes remplacés par des tirets). normaliserDepartement() applique cle() sur
 * l'entrée avant lookup → "Haute-Savoie", "haute savoie", "haute-savoie" matchent tous.
 */
export const DEPARTEMENTS_MAP: Record<string, string> = {
  'ain': '01', 'aisne': '02', 'allier': '03', 'alpes-de-haute-provence': '04',
  'hautes-alpes': '05', 'alpes-maritimes': '06', 'ardeche': '07', 'ardennes': '08',
  'ariege': '09', 'aube': '10', 'aude': '11', 'aveyron': '12', 'bouches-du-rhone': '13',
  'calvados': '14', 'cantal': '15', 'charente': '16', 'charente-maritime': '17',
  'cher': '18', 'correze': '19', 'corse-du-sud': '2A', 'haute-corse': '2B',
  'cote-d-or': '21', 'cotes-d-armor': '22', 'creuse': '23', 'dordogne': '24',
  'doubs': '25', 'drome': '26', 'eure': '27', 'eure-et-loir': '28', 'finistere': '29',
  'gard': '30', 'haute-garonne': '31', 'gers': '32', 'gironde': '33', 'herault': '34',
  'ille-et-vilaine': '35', 'indre': '36', 'indre-et-loire': '37', 'isere': '38',
  'jura': '39', 'landes': '40', 'loir-et-cher': '41', 'loire': '42', 'haute-loire': '43',
  'loire-atlantique': '44', 'loiret': '45', 'lot': '46', 'lot-et-garonne': '47',
  'lozere': '48', 'maine-et-loire': '49', 'manche': '50', 'marne': '51',
  'haute-marne': '52', 'mayenne': '53', 'meurthe-et-moselle': '54', 'meuse': '55',
  'morbihan': '56', 'moselle': '57', 'nievre': '58', 'nord': '59', 'oise': '60',
  'orne': '61', 'pas-de-calais': '62', 'puy-de-dome': '63', 'pyrenees-atlantiques': '64',
  'hautes-pyrenees': '65', 'pyrenees-orientales': '66', 'bas-rhin': '67', 'haut-rhin': '68',
  'rhone': '69', 'haute-saone': '70', 'saone-et-loire': '71', 'sarthe': '72', 'savoie': '73',
  'haute-savoie': '74', 'paris': '75', 'seine-maritime': '76', 'seine-et-marne': '77',
  'yvelines': '78', 'deux-sevres': '79', 'somme': '80', 'tarn': '81', 'tarn-et-garonne': '82',
  'var': '83', 'vaucluse': '84', 'vendee': '85', 'vienne': '86', 'haute-vienne': '87',
  'vosges': '88', 'yonne': '89', 'territoire-de-belfort': '90', 'belfort': '90',
  'essonne': '91', 'hauts-de-seine': '92', 'seine-saint-denis': '93', 'val-de-marne': '94',
  'val-d-oise': '95', 'guadeloupe': '971', 'martinique': '972', 'guyane': '973',
  'la-reunion': '974', 'reunion': '974', 'mayotte': '976',
};

/** Forme canonique d'un libellé : minuscule, sans accent, espaces/apostrophes → tirets. */
function cle(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // accents (diacritiques combinants)
    .replace(/['’\s]+/g, '-')   // apostrophes (' et ’) + espaces
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Normalise un département vers son code INSEE (ex. "Haute-Savoie" → "74").
 * Renvoie null si vide. Renvoie l'entrée brute (+ warning) si non reconnue,
 * pour ne jamais perdre la donnée.
 */
export function normaliserDepartement(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Déjà un code département (01-95, 971-976, 2A/2B).
  const codeMaj = trimmed.toUpperCase();
  if (/^(\d{2,3}|2[AB])$/.test(codeMaj)) return codeMaj;

  // 2. Code postal (5 chiffres) → 3 premiers pour les DOM (97x/98x), 2 sinon.
  if (/^\d{5}$/.test(trimmed)) {
    return /^9[78]/.test(trimmed) ? trimmed.substring(0, 3) : trimmed.substring(0, 2);
  }

  // 3. Nom de département → code via la table.
  const code = DEPARTEMENTS_MAP[cle(trimmed)];
  if (code) return code;

  // 4. Aucun match : on conserve la donnée brute mais on la signale.
  console.warn(`[normaliserDepartement] valeur non reconnue : "${input}"`);
  return trimmed;
}

/** Applique normaliserDepartement sur chaque élément et retire les null. */
export function normaliserDepartements(input: string[] | null | undefined): string[] {
  if (!input) return [];
  return input
    .map(normaliserDepartement)
    .filter((d): d is string => d !== null);
}
