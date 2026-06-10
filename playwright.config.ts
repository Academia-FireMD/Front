import { PlaywrightTestConfig, defineConfig, devices } from '@playwright/test';

// Puerto del dev server para e2e. Por defecto 4201 (intacto para CI). En local
// se puede sobreescribir con E2E_PORT para no colisionar con otros ng serve
// (p.ej. otro worktree ya usando 4201). Si el puerto ya está sirviendo el
// front, Playwright lo reutiliza (reuseExistingServer) y no arranca otro.
const E2E_PORT = process.env['E2E_PORT'] || '4201';
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? 'dot' : 'html',
  timeout: 30_000,
  use: {
    baseURL: E2E_BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `npx ng serve --port ${E2E_PORT}`,
    url: E2E_BASE_URL,
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
