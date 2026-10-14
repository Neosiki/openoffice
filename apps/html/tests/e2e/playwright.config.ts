import { defineConfig } from '@playwright/test'

/**
 * The HTML editor's own Electron E2E (the generate hand-off). Same settings as
 * the root suite (`e2e/playwright.config.ts`): the built app, one at a time.
 * Run: `npx playwright test --config apps/html/tests/e2e/playwright.config.ts`.
 */
export default defineConfig({
  testDir: '.',
  outputDir: '../../../../e2e/test-results',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  expect: { timeout: 15_000 },
  reporter: [['list']],
})
