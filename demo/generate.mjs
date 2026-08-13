/**
 * Demo page generator.
 * Run from the package root: `node demo/generate.mjs`
 * Requires the package to be built first: `npm run build`
 *
 * Produces: demo/index.html — fully self-contained, open in any browser.
 */

import { struktToSvg } from '../dist/index.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dir, '../tests/examples');

// ── Helpers ───────────────────────────────────────────────────────────────────

function htmlEsc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function loadExample(filename, svgWidth = 500) {
  const source = readFileSync(join(examplesDir, filename), 'utf8');
  const svg    = struktToSvg(source.trim(), { width: svgWidth });
  return { source: source.trim(), svg };
}

// ── Examples ──────────────────────────────────────────────────────────────────

const examples = [
  { file: 'binary-search.strukt',    width: 540 },
  { file: 'bubble-sort.strukt',      width: 480 },
  { file: 'parallel-download.strukt', width: 720 },
].map(({ file, width }) => ({ file, ...loadExample(file, width) }));

// ── HTML template ─────────────────────────────────────────────────────────────

function exampleSection({ file, source, svg }) {
  return `
  <section class="example">
    <div class="example-header">${htmlEsc(file)}</div>
    <div class="example-body">
      <div class="source"><pre><code>${htmlEsc(source)}</code></pre></div>
      <div class="diagram">${svg}</div>
    </div>
  </section>`;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Strukt Renderer — Demo</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #f2f3f5;
      color: #1a1a1a;
      padding: 2rem;
      min-height: 100vh;
    }

    .page-header { margin-bottom: 2.5rem; }
    .page-header h1 {
      font-size: 1.8rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .page-header p {
      color: #666;
      margin-top: 0.3rem;
      font-size: 0.95rem;
    }

    .example {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      margin-bottom: 2rem;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
    }

    .example-header {
      background: #1e1e2e;
      color: #cdd6f4;
      padding: 0.55rem 1.2rem;
      font-family: ui-monospace, "Cascadia Code", monospace;
      font-size: 0.82rem;
      letter-spacing: 0.04em;
    }

    .example-body {
      display: grid;
      grid-template-columns: minmax(220px, 340px) 1fr;
    }

    .source {
      padding: 1.2rem;
      background: #fafafa;
      border-right: 1px solid #e8e8e8;
      overflow-x: auto;
    }
    .source pre {
      font-family: ui-monospace, "Cascadia Code", Consolas, monospace;
      font-size: 0.78rem;
      line-height: 1.65;
      color: #333;
      white-space: pre;
    }

    .diagram {
      padding: 1.2rem;
      overflow: auto;
      display: flex;
      align-items: flex-start;
    }
    .diagram svg { display: block; }

    @media (max-width: 680px) {
      .example-body { grid-template-columns: 1fr; }
      .source { border-right: none; border-bottom: 1px solid #e8e8e8; }
    }
  </style>
</head>
<body>
  <header class="page-header">
    <h1>Strukt Renderer</h1>
    <p>Nassi-Shneiderman diagrams generated from pseudocode — strukt-renderer v0.1.0</p>
  </header>
${examples.map(exampleSection).join('\n')}
</body>
</html>
`;

const outPath = join(__dir, 'index.html');
writeFileSync(outPath, html, 'utf8');
console.log('Generated:', outPath);
