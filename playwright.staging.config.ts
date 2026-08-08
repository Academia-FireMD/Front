import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración aislada para la comprobación real de staging. No arranca
 * `ng serve`: el entorno bajo prueba se recibe mediante E2E_STAGING_BASE_URL.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.staging.e2e.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  use: {
    baseURL: process.env['E2E_STAGING_BASE_URL'],
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
