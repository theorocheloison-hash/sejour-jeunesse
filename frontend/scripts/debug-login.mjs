// Debug ponctuel du login local (Phase 0) — lecture seule.
import puppeteer from 'puppeteer';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

page.on('response', (res) => {
  if (res.url().includes('/api/')) {
    console.log(`[net] ${res.status()} ${res.request().method()} ${res.url()}`);
  }
});
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log(`[console.error] ${msg.text()}`);
});

await page.setViewport({ width: 1440, height: 900 });
await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
await page.type('input[type="email"]', process.env.LOGIN_EMAIL);
await page.type('input[type="password"]', process.env.LOGIN_PASSWORD);
await page.click('button[type="submit"]');
await new Promise((r) => setTimeout(r, 6000));
console.log(`url finale : ${page.url()}`);
const errText = await page.evaluate(() => document.body.innerText.slice(0, 600));
console.log('--- texte page ---');
console.log(errText);
const cookies = await page.cookies();
console.log('--- cookies ---');
console.log(cookies.map((c) => `${c.name} (httpOnly=${c.httpOnly})`).join('\n') || '(aucun)');
await browser.close();
