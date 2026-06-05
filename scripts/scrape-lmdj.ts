/**
 * Scraping des centres d'hébergement membres de La Montagne des Juniors (LMDJ)
 * depuis le site public savoie-haute-savoie-juniors.com (alimenté par APIDAE).
 *
 * Produit scripts/lmdj-centres.json — à importer ensuite via POST /admin/sync-lmdj.
 *
 * Prérequis :  npm install cheerio   (puis : npx tsx scripts/scrape-lmdj.ts)
 * Node 18+ requis (fetch global).
 */

import * as cheerio from 'cheerio';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://www.savoie-haute-savoie-juniors.com';
const LISTING_URLS = [
  `${BASE}/sejours-scolaires/centres-de-vacances`,
  `${BASE}/colonies-groupes/centres-de-vacances`,
];
const DELAY_MS = 500;
const FETCH_TIMEOUT_MS = 10_000;

// ─── Utilitaires ─────────────────────────────────────────────────────────────

const PARTICULES = new Set([
  'de', 'du', 'des', 'le', 'la', 'les', 'et', 'd', 'l', 'sur', 'sous',
  'au', 'aux', 'en', 'à', 'a',
]);

/** "CHALET LE SAUVAGEON" → "Chalet le Sauvageon" (particules en minuscules sauf 1er mot). */
function titleCase(s: string): string {
  const clean = (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  return clean
    .split(' ')
    .map((word, wi) =>
      word
        .split('-')
        .map((part, pi) => {
          if ((wi > 0 || pi > 0) && PARTICULES.has(part)) return part;
          return part.charAt(0).toUpperCase() + part.slice(1);
        })
        .join('-'),
    )
    .join(' ');
}

/** "chalet-le-sauvageon" → "Chalet Le Sauvageon" (chaque mot capitalisé, tirets→espaces). */
function deslug(slug: string): string {
  return (slug ?? '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Découpe l'URL d'une fiche détail en ses segments signifiants.
 * Format : .../centre-de-vacances/<dept>/<ville>/<nom>
 */
function urlParts(url: string): {
  nomSlug: string;
  villeSlug: string;
  deptSlug: string;
} {
  const path = (url.split('?')[0] || '').replace(/\/+$/, '');
  const segs = path.split('/').filter(Boolean);
  return {
    nomSlug: segs[segs.length - 1] ?? '',
    villeSlug: segs[segs.length - 2] ?? '',
    deptSlug: segs[segs.length - 3] ?? '',
  };
}

/** Numéro standard de l'association LMDJ — à ne jamais attribuer à un centre. */
const LMDJ_PHONE = '0450456954';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Fetch HTML avec timeout 10s et 1 retry. Retourne null en cas d'échec. */
async function fetchHtml(url: string, retries = 1): Promise<string | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LiavoImportBot/1.0)' },
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      clearTimeout(timer);
      if (attempt === retries) {
        console.warn(`  ⚠️  échec fetch ${url} : ${(e as Error).message}`);
        return null;
      }
      await sleep(1000);
    }
  }
  return null;
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface ListingEntry {
  url: string;
  capacite: number | null; // lits (donnée du listing)
  classesEN: number | null; // classes EN (donnée du listing)
}

interface CentreData {
  nom: string;
  ville: string;
  departement: string;
  codePostal: string;
  adresse: string;
  telephone: string | null;
  email: string | null;
  siteWeb: string | null;
  description: string | null;
  capacite: number;
  capaciteEN: number | null;
  capaciteDDCS: number | null;
  capaciteAdultes: number | null;
  classesEN: number | null;
  imageUrl: string | null;
  apidaeId: string | null;
  latitude: number | null;
  longitude: number | null;
  accessiblePmr: boolean;
  equipements: string[];
  niveauxScolaires: string[];
  urlFicheLmdj: string;
}

// ─── Passe 1 : listing ───────────────────────────────────────────────────────
//
// Le listing est un <table> : chaque centre occupe une cellule <td>. On n'en
// extrait QUE l'URL de la fiche détail + les chiffres (lits / classes EN).
// Nom, ville et département proviennent exclusivement de la fiche détail.

function parseListing(html: string): ListingEntry[] {
  const $ = cheerio.load(html, { decodeEntities: true } as cheerio.CheerioOptions);
  const out: ListingEntry[] = [];
  const seen = new Set<string>();

  $('a[href*="/centre-de-vacances/"]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (!href.includes('/centre-de-vacances/')) return;
    const url = href.startsWith('http')
      ? href
      : `${BASE}${href.startsWith('/') ? '' : '/'}${href}`;
    if (seen.has(url)) return;

    // Conteneur de la carte = la cellule <td> de cette ligne (1 centre = 1 td).
    // Fallback : le texte du lien lui-même (qui contient déjà lits/classes).
    const card = $(el).closest('td');
    const cardText = (card.length ? card.text() : $(el).text())
      .replace(/ /g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const lits = cardText.match(/(\d+)\s*lits/i);
    const classes = cardText.match(/(\d+)\s*classes/i);

    seen.add(url);
    out.push({
      url,
      capacite: lits ? Number(lits[1]) : null,
      classesEN: classes ? Number(classes[1]) : null,
    });
  });

  return out;
}

// ─── Passe 2 : fiche détail ──────────────────────────────────────────────────

function parseDetail(html: string, listing: ListingEntry): CentreData {
  const $ = cheerio.load(html, { decodeEntities: true } as cheerio.CheerioOptions);
  const flat = $('body').text().replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

  const { nomSlug, villeSlug, deptSlug } = urlParts(listing.url);

  // ── Nom : <h1> de la fiche détail. Fallback : dernier segment de l'URL. ──
  let nom = $('h1').first().text().replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  if (!nom) nom = deslug(nomSlug);

  // ── Ville + code postal : ligne "Ville (CP)" juste sous le <h1>. ──
  // Fallback ville : avant-dernier segment de l'URL.
  let ville = '';
  let cpFromHeader = '';
  $('h1')
    .first()
    .nextAll()
    .slice(0, 6)
    .each((_, e) => {
      if (ville) return;
      const t = $(e).text().replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
      const m = t.match(/^(.+?)\s*\((7[34]\d{3})\)\s*$/);
      if (m) {
        ville = m[1].trim();
        cpFromHeader = m[2];
      }
    });
  if (!ville) ville = deslug(villeSlug);

  // ── Département : 3e segment de l'URL (fiable par fiche). ──
  // titleCase conserve les tirets : "haute-savoie" → "Haute-Savoie".
  const departement = titleCase(deptSlug) || 'Haute-Savoie';

  // Description : <h4>Description</h4> → paragraphe suivant
  let description: string | null = null;
  $('h1, h2, h3, h4, h5').each((_, el) => {
    if (description) return;
    if (/^\s*description\s*$/i.test($(el).text())) {
      const txt =
        $(el).nextAll('p').first().text().trim() ||
        $(el).next().text().trim();
      if (txt) description = txt.replace(/\s+/g, ' ').substring(0, 2000);
    }
  });

  // ── Téléphone : extrait de CETTE fiche, en filtrant le standard LMDJ. ──
  // On collecte tous les numéros (0X XX XX XX XX ou 0X.XX.XX.XX.XX) et on
  // retient le premier qui n'est PAS le numéro de l'association LMDJ.
  const phoneMatches = flat.match(/0[1-9](?:[ .]?\d{2}){4}/g) ?? [];
  let telephone: string | null = null;
  for (const p of phoneMatches) {
    const digits = p.replace(/\D/g, '');
    if (digits.length !== 10) continue;
    if (digits === LMDJ_PHONE) continue; // standard de l'association, pas du centre
    telephone = digits.replace(/(\d{2})(?=\d)/g, '$1 '); // "0X XX XX XX XX"
    break;
  }

  // Email : premier lien mailto
  let email: string | null = null;
  $('a[href^="mailto:"]').each((_, el) => {
    if (email) return;
    const m = ($(el).attr('href') ?? '').replace(/^mailto:/i, '').split('?')[0].trim();
    if (m.includes('@')) email = m.toLowerCase();
  });

  // Site web : lien http externe (≠ site LMDJ, ≠ apidae, ≠ maps/réseaux sociaux)
  let siteWeb: string | null = null;
  $('a[href^="http"]').each((_, el) => {
    if (siteWeb) return;
    const h = $(el).attr('href') ?? '';
    if (
      /savoie-haute-savoie-juniors\.com|apidae-tourisme|google\.|facebook|instagram|twitter|x\.com|youtube|linkedin/i.test(
        h,
      )
    ) {
      return;
    }
    siteWeb = h.split('?')[0];
  });

  // Coordonnées GPS : lien Google Maps daddr=LAT,LON
  let latitude: number | null = null;
  let longitude: number | null = null;
  const gps = html.match(/daddr=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (gps) {
    latitude = Number(gps[1]);
    longitude = Number(gps[2]);
  }

  // Image principale APIDAE
  let imageUrl: string | null = null;
  $('img').each((_, el) => {
    if (imageUrl) return;
    const src = $(el).attr('src') ?? $(el).attr('data-src') ?? '';
    if (/static\.apidae-tourisme\.com/i.test(src)) imageUrl = src;
  });
  if (!imageUrl) {
    const m = html.match(/https?:\/\/static\.apidae-tourisme\.com[^\s"')]+/i);
    if (m) imageUrl = m[0];
  }

  // APIDAE Object ID : images-principales/<a>/<b>/<ID>-diaporama
  let apidaeId: string | null = null;
  const idMatch = (imageUrl ?? html).match(
    /images-principales\/\d+\/\d+\/(\d+)-diaporama/i,
  );
  if (idMatch) apidaeId = idMatch[1];

  // Capacités (section Publics et Tarifs)
  const capEN = flat.match(/Capacit[ée]\s*[ÉE]ducation\s*Nationale\s*:?\s*(\d+)/i);
  const capDDCS = flat.match(/Capacit[ée]\s*DDCS\s*:?\s*(\d+)/i);
  const capTot = flat.match(/Capacit[ée]\s*totale\s*:?\s*(\d+)/i);
  const capaciteEN = capEN ? Number(capEN[1]) : null;
  const capaciteDDCS = capDDCS ? Number(capDDCS[1]) : null;
  const capaciteTotale = capTot ? Number(capTot[1]) : null;

  // Accessible PMR
  const accessiblePmr = /handicap\s*moteur/i.test(flat);

  // Code postal : priorité au CP lu sous le <h1>, sinon recherche dans la page.
  const cpMatch = flat.match(/\((7[34]\d{3})\)/) ?? flat.match(/\b(7[34]\d{3})\b/);
  const codePostal = cpFromHeader || (cpMatch ? cpMatch[1] : '');

  // Équipements : <li> sous "Equipements de l'hébergement"
  const equipements: string[] = [];
  $('h1, h2, h3, h4, h5').each((_, el) => {
    if (/[ée]quipements?\s+de\s+l['’]h[ée]bergement/i.test($(el).text())) {
      $(el)
        .nextAll('ul')
        .first()
        .find('li')
        .each((__, li) => {
          const t = $(li).text().replace(/\s+/g, ' ').trim();
          if (t && !equipements.includes(t)) equipements.push(t);
        });
    }
  });

  // Niveaux scolaires : ligne "Scolaire :" dans "Publics accueillis"
  const niveauxScolaires: string[] = [];
  const NIVEAUX = ['Maternelle', 'Primaire', 'Élémentaire', 'Collège', 'Lycée'];
  const sco = flat.match(/Scolaire\s*:?\s*([^.|\n]{0,120})/i);
  if (sco) {
    for (const n of NIVEAUX) {
      if (new RegExp(n, 'i').test(sco[1]) && !niveauxScolaires.includes(n)) {
        niveauxScolaires.push(n);
      }
    }
  }

  const capacite =
    capaciteTotale ?? listing.capacite ?? capaciteEN ?? capaciteDDCS ?? 0;

  return {
    nom,
    ville,
    departement,
    codePostal,
    adresse: '',
    telephone,
    email,
    siteWeb,
    description,
    capacite,
    capaciteEN,
    capaciteDDCS,
    capaciteAdultes: null,
    classesEN: listing.classesEN,
    imageUrl,
    apidaeId,
    latitude,
    longitude,
    accessiblePmr,
    equipements,
    niveauxScolaires,
    urlFicheLmdj: listing.url,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Passe 1 — listing des centres...');
  const map = new Map<string, ListingEntry>();
  for (const url of LISTING_URLS) {
    const html = await fetchHtml(url);
    if (!html) {
      console.warn(`  ⚠️  listing introuvable : ${url}`);
      continue;
    }
    const entries = parseListing(html);
    console.log(`  ${entries.length} liens trouvés sur ${url}`);
    for (const e of entries) if (!map.has(e.url)) map.set(e.url, e);
    await sleep(DELAY_MS);
  }

  const entries = [...map.values()];
  console.log(`  → ${entries.length} centres uniques après déduplication par URL\n`);

  console.log('Passe 2 — fiches détail...');
  const centres: CentreData[] = [];
  let i = 0;
  for (const entry of entries) {
    const html = await fetchHtml(entry.url);
    if (html) {
      centres.push(parseDetail(html, entry));
    } else {
      // Fallback : fiche inaccessible → on dérive nom/ville/dept depuis l'URL.
      const { nomSlug, villeSlug, deptSlug } = urlParts(entry.url);
      centres.push({
        nom: deslug(nomSlug),
        ville: deslug(villeSlug),
        departement: titleCase(deptSlug) || 'Haute-Savoie',
        codePostal: '',
        adresse: '',
        telephone: null,
        email: null,
        siteWeb: null,
        description: null,
        capacite: entry.capacite ?? 0,
        capaciteEN: null,
        capaciteDDCS: null,
        capaciteAdultes: null,
        classesEN: entry.classesEN,
        imageUrl: null,
        apidaeId: null,
        latitude: null,
        longitude: null,
        accessiblePmr: false,
        equipements: [],
        niveauxScolaires: [],
        urlFicheLmdj: entry.url,
      });
    }
    i++;
    if (i % 10 === 0) console.log(`  ${i}/${entries.length} fiches traitées`);
    await sleep(DELAY_MS);
  }

  const outPath = join(process.cwd(), 'scripts', 'lmdj-centres.json');
  writeFileSync(outPath, JSON.stringify(centres, null, 2), 'utf8');

  const withEmail = centres.filter((c) => c.email).length;
  const withApidae = centres.filter((c) => c.apidaeId).length;
  const withTel = centres.filter((c) => c.telephone).length;
  console.log(
    `\n✅ ${centres.length} centres scrapés, ${withEmail} avec email, ${withTel} avec téléphone, ${withApidae} avec APIDAE ID`,
  );
  console.log(`→ ${outPath}\n`);

  // Contrôle qualité
  const noms = new Set(centres.map((c) => c.nom));
  const villes = new Set(centres.map((c) => c.ville));
  console.log(`   ${noms.size} noms distincts, ${villes.size} villes distinctes`);

  const sansDesc = centres.filter((c) => !c.description);
  const sansEmail = centres.filter((c) => !c.email);
  if (sansDesc.length) {
    console.log(`⚠️  ${sansDesc.length} centres sans description :`);
    for (const c of sansDesc) console.log(`    - ${c.nom} (${c.ville})`);
  }
  if (sansEmail.length) {
    console.log(`⚠️  ${sansEmail.length} centres sans email :`);
    for (const c of sansEmail) console.log(`    - ${c.nom} (${c.ville})`);
  }
}

main().catch((e) => {
  console.error('Erreur fatale :', e);
  process.exit(1);
});
