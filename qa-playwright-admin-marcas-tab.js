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

  // Expandir la primera fila
  const chevron = page.locator('.pi-chevron-down, .pi-angle-down').first();
  await chevron.click();
  await page.waitForTimeout(3000);

  // Verificar que el expanded row existe antes de buscar el tab
  const expandedRow = page.locator('.planifications-expansion, [data-testid*="expanded"]').first();
  if (await expandedRow.count()) {
    console.log('Expanded row encontrado');
    const tabs = await page.locator('.p-tabview-nav li, [role="tab"]').all();
    console.log('Tabs encontrados:', tabs.length);
    for (const tab of tabs) {
      const text = await tab.textContent();
      console.log('Tab:', text.trim());
    }
  } else {
    console.log('Expanded row NO encontrado');
  }

  // Click en el tab "Marcas físicas" (buscar por texto parcial o icono)
  const marcasTab = page.locator('.p-tabview-nav li:has-text("Marcas")').first();
  await marcasTab.click();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT_DIR, '24-admin-usuario-marcas-tab.png'), fullPage: true });

  await browser.close();
  console.log('QA admin marcas tab completado.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
