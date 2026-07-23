const { chromium } = require('/home/tstoychev/Escritorio/projects/AcademiaFireMD/Front/node_modules/.pnpm/playwright-core@1.58.2/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://app-staging.tecnikafire.com';
const OUT_DIR = '/home/tstoychev/Escritorio/projects/AcademiaFireMD/docs/sergio-peticiones-2026-07-06/qa-fase2';

const ADMIN_EMAIL = 'shishi2@gmail.com';
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

  // ADMIN: user-dashboard con marcas del alumno
  await login(page, ADMIN_EMAIL);
  await page.hover('.lateral-bar');
  await page.waitForTimeout(1500);
  const usuariosLink = page.locator('text=Usuarios').first();
  await usuariosLink.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT_DIR, '22-admin-usuarios-lista.png'), fullPage: true });

  // Expandir el primer usuario para ver marcas
  const expandBtn = page.locator('.p-row-toggler, button[aria-label*="expand"], [data-pc-section="rowtoggler"]').first();
  if (await expandBtn.count()) {
    await expandBtn.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT_DIR, '23-admin-usuario-expanded-marcas.png'), fullPage: true });
  } else {
    console.log('No se encontró botón de expansión');
    // Intentar click en la primera fila
    const firstRow = page.locator('tbody tr').first();
    if (await firstRow.count()) {
      await firstRow.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: path.join(OUT_DIR, '23-admin-usuario-expanded-marcas.png'), fullPage: true });
    }
  }

  await browser.close();
  console.log('QA admin completado.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
