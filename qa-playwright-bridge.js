const { chromium } = require('/home/tstoychev/Escritorio/projects/AcademiaFireMD/Front/node_modules/.pnpm/playwright-core@1.58.2/node_modules/playwright-core');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'https://app-staging.tecnikafire.com';
const OUT_DIR = '/home/tstoychev/Escritorio/projects/AcademiaFireMD/docs/sergio-peticiones-2026-07-06/qa-fase2';

const ALUMNO_EMAIL = 'alumno-test@tecnikafire.com';
const ADMIN_EMAIL = 'shishi2@gmail.com';
const PASSWORD = 'Guarilla12*';

async function login(page, email) {
  await page.goto(`${BASE_URL}/auth/login`);
  await page.waitForSelector('input[formcontrolname="email"]', { timeout: 15000 });
  await page.fill('input[formcontrolname="email"]', email);
  await page.fill('app-password-input input', PASSWORD);
  await page.screenshot({ path: path.join(OUT_DIR, 'debug-login-fill.png') });
  await page.click('app-async-button p-button');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(OUT_DIR, 'debug-login-after-click.png') });
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. ALUMNO: planificación mensual con bloque físico vinculado
  await login(page, ALUMNO_EMAIL);
  console.log('Alumno URL tras login:', page.url());

  // Hacer hover sobre el menú lateral para expandirlo
  await page.hover('.lateral-bar');
  await page.waitForTimeout(1500);

  // Buscar el item del menú por su aria-label o texto
  const menuItem = page.locator('[aria-label*="Planificación"], li:has-text("Planificación"), a:has-text("Planificación")').first();
  if (await menuItem.count()) {
    console.log('Haciendo click en Planificación mensual...');
    await menuItem.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  } else {
    console.log('No se encontró item Planificación mensual tras hover');
  }

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  console.log('Alumno URL tras navegación:', page.url());
  await page.screenshot({ path: path.join(OUT_DIR, '01-alumno-temario-semanal.png'), fullPage: true });

  // Click en el bloque vinculado para ir al detalle de física
  const fisicaBadge = page.locator('[data-testid="fisica-badge"]').first();
  if (await fisicaBadge.count()) {
    await fisicaBadge.click();
    await page.waitForURL('**/planificacion-fisica/dia/**', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_DIR, '02-alumno-fisica-detalle.png'), fullPage: true });
  } else {
    console.log('No se encontró badge física en alumno');
  }

  // 2. ADMIN: editor de planificación mensual
  await login(page, ADMIN_EMAIL);
  console.log('Admin URL tras login:', page.url());

  // Navegar a planificación mensual usando hover + click
  await page.hover('.lateral-bar');
  await page.waitForTimeout(1500);
  const planificacionAdminLink = page.locator('a:has-text("Planificación mensual")').first();
  if (await planificacionAdminLink.count()) {
    console.log('Haciendo click en Planificación mensual (admin)...');
    await planificacionAdminLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
  }

  console.log('Admin URL tras navegación:', page.url());
  await page.screenshot({ path: path.join(OUT_DIR, '03-admin-planificacion-mensual.png'), fullPage: true });

  // Hacer click en la planificación PGCVA6-8H para editarla
  const planificacionRow = page.locator('text=PGCVA6-8H').first();
  if (await planificacionRow.count()) {
    console.log('Haciendo click en planificación PGCVA6-8H...');
    await planificacionRow.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT_DIR, '04-admin-editar-planificacion.png'), fullPage: true });

    // Abrir menú contextual en un hueco del calendario
    const calendarArea = page.locator('.cal-time-events').first();
    if (await calendarArea.count()) {
      await calendarArea.click({ button: 'right' });
      await page.waitForTimeout(1000);
      await page.screenshot({ path: path.join(OUT_DIR, '05-admin-menu-contextual.png'), fullPage: true });
      await page.keyboard.press('Escape');
    }
  } else {
    console.log('No se encontró planificación PGCVA6-8H en la lista');
  }

  await browser.close();
  console.log('QA visual completado. Screenshots en:', OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
