// Screenshots responsive — usage :
//   node scripts/shots.mjs <path> [<path> ...]
//   LOGIN_EMAIL=x LOGIN_PASSWORD=y node scripts/shots.mjs /dashboard/hebergeur
//   MOCK_ROLE=HEBERGEUR node scripts/shots.mjs /dashboard/hebergeur
// Options env :
//   BASE_URL   (défaut http://localhost:3000)
//   WIDTHS     (défaut 375,768,1440)
//   FULLPAGE=0 pour viewport seul (défaut full page)
//   MOCK_ROLE  auth simulée : user dans localStorage + interception de TOUTES les
//              requêtes /api/* avec une réponse locale 200 [] — AUCUNE requête ne
//              part vers l'API (prod). Vérifie le chrome et les états vides.
// PNG écrits dans screenshots/<path-slug>-<width>.png
// Hors build Next (dossier scripts/, pas d'import app).

import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { mockBody } from './mock.mjs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const WIDTHS = (process.env.WIDTHS ?? '375,768,1440').split(',').map(Number);
const FULLPAGE = process.env.FULLPAGE !== '0';
const OUT_DIR = path.join(process.cwd(), 'screenshots');

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error('Usage: node scripts/shots.mjs <path> [<path> ...]');
  process.exit(1);
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const slug = (p) => (p === '/' ? 'home' : p.replace(/^\//, '').replace(/[/?&=\[\]]+/g, '-').replace(/-+$/, ''));

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(60000);

// Auth simulée : profil dans localStorage + API mockée vide (rien ne part en réseau).
if (process.env.MOCK_ROLE) {
  await page.evaluateOnNewDocument((role) => {
    localStorage.setItem('sj_user_v2', JSON.stringify({
      id: 'mock-user', email: 'mock@test.local', firstName: 'Test', lastName: 'Mobile', role,
    }));
  }, process.env.MOCK_ROLE);
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    if (req.url().includes('/api/')) {
      req.respond({ status: 200, contentType: 'application/json', body: mockBody(req.url()) });
    } else {
      req.continue();
    }
  });
}

// Login optionnel (formulaire /login) — la session (cookies) persiste dans l'onglet.
if (process.env.LOGIN_EMAIL && process.env.LOGIN_PASSWORD) {
  console.log(`login ${process.env.LOGIN_EMAIL}…`);
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
  await page.type('input[type="email"]', process.env.LOGIN_EMAIL);
  await page.type('input[type="password"]', process.env.LOGIN_PASSWORD);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await new Promise((r) => setTimeout(r, 2000));
  console.log(`  → url après login : ${page.url()}`);
}

for (const p of paths) {
  for (const width of WIDTHS) {
    await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1200));
    // CLICK='selector css' : clique avant le screenshot (ex. ouvrir le drawer mobile)
    if (process.env.CLICK) {
      await page.click(process.env.CLICK).catch((e) => console.log(`  (clic raté : ${e.message})`));
      await new Promise((r) => setTimeout(r, 500));
    }
    const file = path.join(OUT_DIR, `${slug(p)}${process.env.SUFFIX ?? ''}-${width}.png`);
    await page.screenshot({ path: file, fullPage: FULLPAGE });
    console.log(`✓ ${file}`);
  }
}

await browser.close();
