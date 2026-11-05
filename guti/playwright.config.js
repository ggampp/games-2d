import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '*.spec.js',
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:5178',
    headless: true,
    // Permite usar um Chromium já instalado (ex.: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium).
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: { command: 'npm run dev -- --port 5178', url: 'http://127.0.0.1:5178', reuseExistingServer: true },
});
