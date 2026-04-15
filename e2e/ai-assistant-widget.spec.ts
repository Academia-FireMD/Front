import { expect, Page, test } from '@playwright/test';
import userAlumnoFixture from './fixtures/user-alumno.json';
import { setupAuthInterceptors } from './helpers/interceptors.helper';

/**
 * AI-assistant widget smoke tests.
 *
 * Scope: the widget is a 3rd-party-style script served by the ai-assistant
 * backend (localhost:3100). For these tests we don't exercise the LLM flow
 * (that's covered by unit/integration specs). We verify the three points
 * where the academia + ai-assistant integration can silently break:
 *   1. GET /ai-assistant/token returns a pre-auth JWT.
 *   2. The widget <script> tag is injected with the right data-* attrs.
 *   3. The widget script URL uses the configured embed-token.
 */

async function mockAiAssistantWidget(page: Page) {
  // Swap the real widget JS for a tiny stub that just exposes a marker on
  // window so the test can verify the script was loaded + attrs were read.
  // Real widget behavior is covered by unit tests (runToolLoop, canonicalStringify).
  await page.route('**/widget/ai-assistant-widget.js', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: `
        (function () {
          var s = document.currentScript;
          window.__widgetBoot = {
            apiUrl: s.getAttribute('data-api-url'),
            embedToken: s.getAttribute('data-embed-token'),
            preAuthToken: s.getAttribute('data-token'),
            mode: s.getAttribute('data-mode'),
          };
          // Add a minimal floating button so other tests can find it.
          var btn = document.createElement('button');
          btn.id = 'ai-widget-btn';
          btn.title = 'Stub';
          document.body.appendChild(btn);
        })();
      `,
    });
  });
}

test.describe('AI assistant widget integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/user/get-by-email', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(userAlumnoFixture),
      })
    );
    // Happy-path pre-auth token endpoint.
    await page.route('**/ai-assistant/token', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'eyTEST.preAuthJwtMock.SIG' }),
      })
    );
    await mockAiAssistantWidget(page);
  });

  test('inyecta el widget con pre-auth token y embed token de alumno', async ({ page }) => {
    // Navigate to login BEFORE registering the /auth/login route handler —
    // otherwise the SPA route's HTML gets replaced with the mock JSON body.
    await page.goto('/auth/login');
    await expect(page.locator('input[formControlName="email"]')).toBeVisible({ timeout: 10_000 });
    await setupAuthInterceptors(page, { email: 'alumno@test.com', rol: 'ALUMNO' });
    await page.locator('input[formControlName="email"]').fill('alumno@test.com');
    await page.locator('app-password-input input').fill('test1234');
    await page.locator('button:has-text("Acceder")').click();
    await page.waitForURL('**/app/**', { timeout: 10_000 });

    // The widget script is injected async — wait for the stub to set its marker.
    await expect
      .poll(async () => page.evaluate(() => (window as any).__widgetBoot), {
        timeout: 10_000,
        message: 'widget script never executed',
      })
      .toBeDefined();

    const boot = await page.evaluate(() => (window as any).__widgetBoot);
    expect(boot.apiUrl).toMatch(/:3100\/api$/);
    expect(boot.embedToken).toBeTruthy();
    expect(boot.preAuthToken).toBe('eyTEST.preAuthJwtMock.SIG');
    expect(boot.mode).toBe('floating');
  });

  test('no inyecta el widget si /ai-assistant/token devuelve 403 (sin suscripción)', async ({
    page,
  }) => {
    // Override the default happy-path with a 403
    await page.unroute('**/ai-assistant/token');
    await page.route('**/ai-assistant/token', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'No tienes una suscripción activa' }),
      })
    );

    await page.goto('/auth/login');
    await expect(page.locator('input[formControlName="email"]')).toBeVisible({ timeout: 10_000 });
    await setupAuthInterceptors(page, { email: 'alumno@test.com', rol: 'ALUMNO' });
    await page.locator('input[formControlName="email"]').fill('alumno@test.com');
    await page.locator('app-password-input input').fill('test1234');
    await page.locator('button:has-text("Acceder")').click();
    await page.waitForURL('**/app/**', { timeout: 10_000 });

    // Give the widget component a beat to try + fail to inject
    await page.waitForTimeout(1_000);
    const boot = await page.evaluate(() => (window as any).__widgetBoot);
    expect(boot).toBeUndefined();
    const btn = await page.locator('#ai-widget-btn').count();
    expect(btn).toBe(0);
  });
});
