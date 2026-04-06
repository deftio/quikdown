const { defineConfig } = require('@playwright/test');

const useExternalServer = process.env.NO_WEBSERVER === '1';

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  retries: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 10000,
    baseURL: 'http://localhost:8787',
  },
  // When NO_WEBSERVER=1, assume server is managed externally (e.g. by tools/e2e.sh)
  ...(useExternalServer ? {} : {
    webServer: {
      command: 'npx serve . -l 8787',
      port: 8787,
      reuseExistingServer: true,
      timeout: 10000,
    },
  }),
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
});
