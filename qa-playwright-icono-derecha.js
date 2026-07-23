const { chromium } = require('/home/tstoychev/Escritorio/projects/AcademiaFireMD/Front/node_modules/.pnpm/playwright-core@1.58.2/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://app-staging.tecnikafire.com';
const OUT_DIR = '/home/tstoychev/Escritorio/projects/AcademiaFireMD/docs/sergio-peticiones-2026-07-06/qa-fase2';

const ALUMNO_EMAIL = 'alumno-test@tecnikafire.com';
const PASSWORD = 'Guarilla12*';

async function login(page, email) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForSelector('input[formcontrolname="email"]', { timeout: 15000 });
  await page.fill('input[formcontrolname="email"]', email);
  await page.fill('app-password-input input', PASSWORD);
  await page.click('app-async-button p-button');
  await page.waitForURL('**/app/**', { timeout: 15000 });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // ALUMNO: planificación mensual con icono a la derecha
  await login(page, ALUMNO_EMAIL);
  await page.hover('.lateral-bar');
  await page.waitForTimeout(1500);
  const planificacionLink = page.locator('text=Planificación mensual').first();
  await planificacionLink.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT_DIR, '25-alumno-temario-icono-derecha.png'), fullPage: true });

  await browser.close();
  console.log('Captura icono derecha completada.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
