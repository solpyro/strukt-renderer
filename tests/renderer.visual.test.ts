/// <reference lib="dom" />
/// <reference types="vite/client" />
import { describe, it, expect } from 'vitest';
import { page, commands } from '@vitest/browser/context';
import type { RenderOptions } from '../src/index';
import { struktToSvg } from '../src/index';

// ?raw imports — Vite serves these as plain strings in browser mode
import binarySearch from './examples/binary-search.strukt?raw';
import bubbleSort from './examples/bubble-sort.strukt?raw';
import parallelDownload from './examples/parallel-download.strukt?raw';

// ---------------------------------------------------------------------------
// Extend BrowserCommands with the custom command defined in vitest.browser.config.ts
// ---------------------------------------------------------------------------

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    matchScreenshot(
      name: string,
      base64: string,
    ): Promise<{ action: 'created' | 'matched' | 'mismatch' }>;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function mountSvg(source: string, options?: RenderOptions): Promise<void> {
  document.body.style.margin = '0';
  document.body.innerHTML = struktToSvg(source, options);
  await document.fonts.ready;
}

async function expectMatchesScreenshot(name: string): Promise<void> {
  const svg = document.querySelector('svg')!;
  // save:false → returns base64 directly without writing to __screenshots__
  const base64 = await page.screenshot({ element: svg, save: false });
  const { action } = await commands.matchScreenshot(name, base64);
  if (action === 'created') {
    // Baseline written on first run — pass so the suite can continue.
    console.log(`  ↳ visual baseline created: tests/__screenshots__/${name}.png`);
    return;
  }
  expect(action, `Screenshot mismatch for "${name}" — run UPDATE_SCREENSHOTS=1 to update`).toBe('matched');
}

// ---------------------------------------------------------------------------
// Node types — one test per node kind
// ---------------------------------------------------------------------------

describe('visual — node types', () => {
  it('process node', async () => {
    await mountSvg('set x to 0');
    await expectMatchesScreenshot('node-process');
  });

  it('call node', async () => {
    await mountSvg('call validateInput(data)');
    await expectMatchesScreenshot('node-call');
  });

  it('return node', async () => {
    await mountSvg('return result');
    await expectMatchesScreenshot('node-return');
  });

  it('if-else node', async () => {
    await mountSvg('if x > 0:\n    positive\nelse:\n    negative');
    await expectMatchesScreenshot('node-if-else');
  });

  it('else-if chain', async () => {
    await mountSvg('if x > 0:\n    positive\nelse if x == 0:\n    zero\nelse:\n    negative');
    await expectMatchesScreenshot('node-else-if-chain');
  });

  it('switch node', async () => {
    await mountSvg(
      'switch day:\n    case Monday:\n        start report\n    case Friday:\n        send summary\n    default:\n        continue',
    );
    await expectMatchesScreenshot('node-switch');
  });

  it('while node', async () => {
    await mountSvg('while queue is not empty:\n    process item');
    await expectMatchesScreenshot('node-while');
  });

  it('do-while node', async () => {
    await mountSvg('do:\n    read line\nwhile more lines remain');
    await expectMatchesScreenshot('node-do-while');
  });

  it('for node', async () => {
    await mountSvg('for i from 1 to n:\n    sum = sum + i');
    await expectMatchesScreenshot('node-for');
  });

  it('loop node', async () => {
    await mountSvg('loop:\n    wait for event');
    await expectMatchesScreenshot('node-loop');
  });

  it('parallel node', async () => {
    await mountSvg('parallel:\n    thread:\n        download file A\n    thread:\n        download file B');
    await expectMatchesScreenshot('node-parallel');
  });
});

// ---------------------------------------------------------------------------
// Themes
// ---------------------------------------------------------------------------

describe('visual — themes', () => {
  it('light theme (default)', async () => {
    await mountSvg('call sort(array)\nreturn result');
    await expectMatchesScreenshot('theme-light');
  });

  it('dark theme', async () => {
    await mountSvg('call sort(array)\nreturn result', { theme: 'dark' });
    await expectMatchesScreenshot('theme-dark');
  });
});

// ---------------------------------------------------------------------------
// Full example diagrams
// ---------------------------------------------------------------------------

describe('visual — example diagrams', () => {
  it('binary search', async () => {
    await mountSvg(binarySearch, { width: 700 });
    await expectMatchesScreenshot('example-binary-search');
  });

  it('bubble sort', async () => {
    await mountSvg(bubbleSort, { width: 700 });
    await expectMatchesScreenshot('example-bubble-sort');
  });

  it('parallel download', async () => {
    await mountSvg(parallelDownload, { width: 700 });
    await expectMatchesScreenshot('example-parallel-download');
  });
});
