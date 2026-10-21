import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const port = Number(process.env.PLAYWRIGHT_COMPRAS_PORT ?? '4297');
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error(
    'PLAYWRIGHT_COMPRAS_PORT debe ser un puerto entre 1 y 65535.',
  );
}
const baseURL = `http://127.0.0.1:${port}`;
const outputDir = resolve(
  process.env.PLAYWRIGHT_COMPRAS_OUTPUT_DIR ??
    join(tmpdir(), 'academia-compras-playwright-results'),
);

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/compras-datos-fiscales.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir,
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `node node_modules/@angular/cli/bin/ng.js serve --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
