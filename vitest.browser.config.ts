import { defineConfig } from 'vitest/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const screenshotsDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  'tests/__screenshots__',
);

export default defineConfig({
  test: {
    name: 'browser',
    include: ['tests/**/*.visual.test.ts'],
    browser: {
      provider: 'playwright',
      enabled: true,
      instances: [{ browser: 'chromium' }],
      headless: true,
      commands: {
        // Server-side command: save PNG on first run, compare bytes on subsequent runs.
        matchScreenshot(_ctx, name: string, base64: string) {
          const baselinePath = resolve(screenshotsDir, `${name}.png`);
          const current = Buffer.from(base64, 'base64');

          const update = process.env['UPDATE_SCREENSHOTS'] === '1';

          if (update || !existsSync(baselinePath)) {
            mkdirSync(screenshotsDir, { recursive: true });
            writeFileSync(baselinePath, current);
            return { action: 'created' as const };
          }

          return {
            action: current.equals(readFileSync(baselinePath))
              ? ('matched' as const)
              : ('mismatch' as const),
          };
        },
      },
    },
  },
});
