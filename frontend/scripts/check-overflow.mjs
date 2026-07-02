// Détecteur de casse mobile : visite chaque page à 375px et signale
// un débordement horizontal (scrollWidth > clientWidth). Lecture seule.
// Usage : [MOCK_ROLE=X] node scripts/check-overflow.mjs <path> [<path> ...]

import puppeteer from 'puppeteer';
import { mockBody } from './mock.mjs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const WIDTH = Number(process.env.WIDTH ?? 375);
const paths = process.argv.slice(2);

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();
page.setDefaultNavigationTimeout(60000);
await page.setViewport({ width: WIDTH, height: 900 });

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

// Erreurs runtime (ex. crash React) : un « ok » sur une page crashée ne vaut rien.
let pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message.split('\n')[0]));

for (const p of paths) {
  try {
    pageErrors = [];
    await page.goto(`${BASE_URL}${p}`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, 1000));
    const { scrollW, clientW } = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
    const overflow = scrollW - clientW;
    const err = pageErrors.length ? ` ⚠ pageerror: ${pageErrors[0]}` : '';
    console.log(`${overflow > 1 ? `✗ OVERFLOW +${overflow}px` : '✓ ok          '} ${p}${err}`);
  } catch (e) {
    console.log(`? erreur       ${p} (${e.message})`);
  }
}
await browser.close();
