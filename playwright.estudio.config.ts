import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env['ESTUDIO_QA_PORT'] ?? '43129');
const staging = process.env['ESTUDIO_QA_VARIANTE'] === 'staging';
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './e2e-privado',
  testMatch: '**/*.pw.ts',
  workers: 1,
  timeout: 45000,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: {
    command: `pnpm exec ng serve --host 127.0.0.1 --port ${port} --configuration ${staging ? 'staging' : 'development'}`,
    url: baseURL,
    reuseExistingServer: process.env['ESTUDIO_QA_REUSE'] === '1',
    timeout: 180000,
  },
});
