# strukt-renderer

Parse **Strukt** pseudocode and render it as a self-contained SVG [Nassi-Shneiderman diagram](https://en.wikipedia.org/wiki/Nassi%E2%80%93Shneiderman_diagram). Works in any JavaScript/TypeScript environment; ships dual ESM + CJS builds with full type declarations.

---

## Quick start

```ts
import { struktToSvg } from 'strukt-renderer';

const svg = struktToSvg(`
title: Binary Search

set low to 0
set high to length of array - 1

while low <= high:
    set mid to floor((low + high) / 2)
    if array[mid] == target:
        return mid
    else if array[mid] < target:
        set low to mid + 1
    else:
        set high to mid - 1

return -1
`, { width: 540 });

document.getElementById('diagram').innerHTML = svg;
```

---

## API

### `struktToSvg(source, options?)`

Parse Strukt source and render it in one call.  
Returns a self-contained `<svg>` string.

```ts
import { struktToSvg } from 'strukt-renderer';

const svg = struktToSvg(source, { width: 600, theme: 'dark' });
```

### `parse(source)`

Parse Strukt source into a `DiagramAST`.  
Throws `StruktParseError` on syntax errors.

```ts
import { parse } from 'strukt-renderer';

const ast = parse(source);   // DiagramAST
```

### `render(ast, options?)`

Render a `DiagramAST` to an SVG string.  
Throws `StruktRenderError` for unrecognised node kinds.

```ts
import { parse, render } from 'strukt-renderer';

const svg = render(parse(source), { width: 720, theme: 'light' });
```

### `RenderOptions`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `width` | `number` | `600` | Total SVG width in pixels |
| `minRowHeight` | `number` | `32` | Minimum height of a single cell |
| `fontSize` | `number` | `14` | Font size in pixels |
| `fontFamily` | `string` | `"monospace"` | CSS font-family for all text |
| `padding` | `number` | `8` | Inner padding (px) between text and cell border |
| `theme` | `"light" \| "dark"` | `"light"` | Built-in colour preset |
| `colors` | `Partial<ColorScheme>` | — | Per-element colour overrides, merged over the theme |

### `ColorScheme`

```ts
interface ColorScheme {
  background:    string;  // diagram background
  border:        string;  // all box outlines
  text:          string;  // all label text
  processFill:   string;  // plain process rectangles
  conditionFill: string;  // if / switch condition bars
  loopFill:      string;  // while / for / loop bars
  callFill:      string;  // call (sub-process) blocks
  exitFill:      string;  // return / break / exit blocks
  parallelFill:  string;  // parallel block header
}
```

Example — override just the border colour:

```ts
const svg = struktToSvg(source, {
  theme: 'dark',
  colors: { border: '#ff6b6b' },
});
```

---

## Development

All commands run from the package root (this directory).

```bash
# Install dependencies
npm install

# Type-check (no emit)
npm run typecheck

# Run all tests
npm test

# Update SVG snapshots after intentional renderer changes
npm test -- --update-snapshots

# Watch mode
npm run test:watch

# Run visual regression tests in headless Chromium (requires Playwright)
npm run test:visual

# Update visual baselines after intentional renderer changes
UPDATE_SCREENSHOTS=1 npm run test:visual

# Build ESM + CJS + .d.ts into dist/
npm run build

# Regenerate the visual demo page (requires a build first)
node demo/generate.mjs

# Remove dist/
npm run clean
```

### Visual demo

After building, open `demo/index.html` in any browser.  
It shows all three example diagrams rendered side-by-side with their source.

To regenerate after code changes:

```bash
npm run build && node demo/generate.mjs
```

---

## Package layout

```
src/
  types.ts       DiagramAST discriminated union + RenderOptions / ColorScheme
  errors.ts      StruktParseError, StruktRenderError
  parser.ts      parse()
  renderer.ts    render()
  index.ts       public API + struktToSvg()
tests/
  parser.test.ts      44 tests
  renderer.test.ts    88 tests (14 SVG snapshots in __snapshots__/)
  renderer.visual.test.ts  16 browser visual regression tests
  examples/           .strukt fixtures used by tests
demo/
  generate.mjs   demo page generator script
  index.html     generated output — open in any browser
dist/            built output (git-ignored)
```
