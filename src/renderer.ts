import type {
  DiagramAST,
  DiagramNode,
  Block,
  RenderOptions,
  ColorScheme,
  IfNode,
  SwitchNode,
  ParallelNode,
} from './types';
import { StruktRenderError } from './errors';

// ── Theme presets ─────────────────────────────────────────────────────────────

const LIGHT_THEME: ColorScheme = {
  background: '#ffffff',
  border: '#333333',
  text: '#222222',
  processFill: '#f8f8f8',
  conditionFill: '#fff3e0',
  loopFill: '#e3f2fd',
  callFill: '#e8f5e9',
  exitFill: '#fce4ec',
  parallelFill: '#f3e5f5',
};

const DARK_THEME: ColorScheme = {
  background: '#1e1e1e',
  border: '#bbbbbb',
  text: '#e0e0e0',
  processFill: '#2d2d2d',
  conditionFill: '#5d3000',
  loopFill: '#0d2d47',
  callFill: '#0d2d1a',
  exitFill: '#3d0a1a',
  parallelFill: '#2d0d47',
};

// ── Resolved config ───────────────────────────────────────────────────────────

interface ResolvedConfig {
  width: number;
  minRowHeight: number;
  fontSize: number;
  fontFamily: string;
  padding: number;
  colors: ColorScheme;
}

function resolveConfig(options?: RenderOptions): ResolvedConfig {
  const theme = options?.theme ?? 'light';
  const base: ColorScheme = theme === 'dark' ? { ...DARK_THEME } : { ...LIGHT_THEME };
  return {
    width: options?.width ?? 600,
    minRowHeight: options?.minRowHeight ?? 32,
    fontSize: options?.fontSize ?? 14,
    fontFamily: options?.fontFamily ?? 'monospace',
    padding: options?.padding ?? 8,
    colors: options?.colors ? { ...base, ...options.colors } : base,
  };
}

// ── Numeric helper ────────────────────────────────────────────────────────────

/** Round to one decimal place to keep SVG output readable. */
function f(n: number): number {
  return Math.round(n * 10) / 10;
}

// ── SVG primitives ────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgRect(
  x: number, y: number, w: number, h: number,
  fill: string, stroke: string,
): string {
  return `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
}

function svgLine(
  x1: number, y1: number, x2: number, y2: number,
  stroke: string,
): string {
  return `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="1"/>`;
}

function svgPolygon(points: Array<[number, number]>, fill: string, stroke: string): string {
  const pts = points.map(([px, py]) => `${f(px)},${f(py)}`).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
}

// ── Text wrapping & height ────────────────────────────────────────────────────

/**
 * Word-wrap `text` to fit `availW` pixels, using a rough character-width
 * heuristic (60 % of font size).  Returns one string per visual line.
 */
function wrapText(text: string, availW: number, cfg: ResolvedConfig): string[] {
  const charW = cfg.fontSize * 0.6;
  const innerW = Math.max(1, availW - cfg.padding * 2);
  const charsPerLine = Math.max(10, Math.floor(innerW / charW));
  if (text.length <= charsPerLine) return [text];

  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= charsPerLine) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      // Hard-truncate a single word that is wider than the column
      current = word.length > charsPerLine
        ? word.slice(0, charsPerLine - 1) + '\u2026'
        : word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

/** Compute the row height needed to display `text` in `availW` pixels. */
function rowHeight(text: string, availW: number, cfg: ResolvedConfig): number {
  const lines = wrapText(text, availW, cfg);
  const lineH = cfg.fontSize + 4;
  return Math.max(cfg.minRowHeight, lines.length * lineH + cfg.padding * 2);
}

/** Emit a centred, optionally bold, possibly multi-line SVG text element. */
function svgCentredText(
  cx: number, cy: number,
  content: string, availW: number,
  cfg: ResolvedConfig,
  bold = false,
  fill?: string,
): string {
  const lines = wrapText(content, availW, cfg);
  const lineH = cfg.fontSize + 4;
  const textColor = fill ?? cfg.colors.text;
  const fw = bold ? ' font-weight="bold"' : '';
  const attrs =
    `text-anchor="middle" font-family="${esc(cfg.fontFamily)}" ` +
    `font-size="${f(cfg.fontSize)}"${fw} fill="${textColor}"`;

  if (lines.length === 1) {
    return `<text x="${f(cx)}" y="${f(cy)}" ${attrs} dominant-baseline="central">${esc(lines[0] ?? '')}</text>`;
  }

  const totalH = lines.length * lineH;
  const startY = cy - totalH / 2 + lineH / 2;
  const tspans = lines
    .map((ln, i) => `<tspan x="${f(cx)}" y="${f(startY + i * lineH)}" dominant-baseline="central">${esc(ln)}</tspan>`)
    .join('');
  return `<text ${attrs}>${tspans}</text>`;
}

// ── Render result ──────────────────────────────────────────────────────────────

interface Rendered {
  svg: string;
  height: number;
}

// ── Column x-position helper ──────────────────────────────────────────────────

/** Compute the left edge (x) of each equal-ish column within [x, x+w]. */
function columnXs(x: number, colWidths: number[]): number[] {
  const result: number[] = [];
  let cur = x;
  for (const cw of colWidths) {
    result.push(cur);
    cur += cw;
  }
  return result;
}

/** Split `w` into `n` equal-ish integer widths (last column absorbs rounding). */
function splitWidth(w: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(w / n);
  return Array.from({ length: n }, (_, i) => (i < n - 1 ? base : w - base * (n - 1)));
}

// ── Block rendering ───────────────────────────────────────────────────────────

function renderBlock(nodes: Block, x: number, y: number, w: number, cfg: ResolvedConfig): Rendered {
  if (nodes.length === 0) {
    // Empty block: draw a blank placeholder cell so the structure is visible.
    const h = cfg.minRowHeight;
    return { svg: svgRect(x, y, w, h, cfg.colors.processFill, cfg.colors.border), height: h };
  }
  const parts: string[] = [];
  let curY = y;
  for (const node of nodes) {
    const r = renderNode(node, x, curY, w, cfg);
    parts.push(r.svg);
    curY += r.height;
  }
  return { svg: parts.join('\n'), height: curY - y };
}

// ── Node dispatch ──────────────────────────────────────────────────────────────

function renderNode(node: DiagramNode, x: number, y: number, w: number, cfg: ResolvedConfig): Rendered {
  switch (node.kind) {
    case 'process':
      return renderProcess(node.text, x, y, w, cfg);
    case 'call':
      return renderCall(node.text, x, y, w, cfg);
    case 'return':
      return renderTerminator(
        node.value !== undefined ? `return ${node.value}` : 'return',
        x, y, w, cfg,
      );
    case 'break':
      return renderTerminator('break', x, y, w, cfg);
    case 'exit':
      return renderTerminator('exit', x, y, w, cfg);
    case 'if':
      return renderIf(node, x, y, w, cfg);
    case 'switch':
      return renderSwitch(node, x, y, w, cfg);
    case 'while':
      return renderLoopPreTest(`while ${node.condition}`, node.body, x, y, w, cfg);
    case 'do-while':
      return renderLoopPostTest(`while ${node.condition}`, node.body, x, y, w, cfg);
    case 'for':
      return renderLoopPreTest(`for ${node.header}`, node.body, x, y, w, cfg);
    case 'loop':
      return renderLoopInfinite(node.body, x, y, w, cfg);
    case 'parallel':
      return renderParallel(node, x, y, w, cfg);
    default: {
      // TypeScript exhaustiveness guard — triggers only for future node kinds.
      const _exhaustive: never = node;
      throw new StruktRenderError(
        'Unrecognised node kind',
        (_exhaustive as DiagramNode).kind,
      );
    }
  }
}

// ── Process ────────────────────────────────────────────────────────────────────

function renderProcess(label: string, x: number, y: number, w: number, cfg: ResolvedConfig): Rendered {
  const h = rowHeight(label, w, cfg);
  return {
    svg: [
      svgRect(x, y, w, h, cfg.colors.processFill, cfg.colors.border),
      svgCentredText(x + w / 2, y + h / 2, label, w, cfg),
    ].join('\n'),
    height: h,
  };
}

// ── Call — sub-process with double vertical bars (DIN 66261) ──────────────────

function renderCall(label: string, x: number, y: number, w: number, cfg: ResolvedConfig): Rendered {
  const BAR_W = 6;
  const h = rowHeight(label, w - BAR_W * 2, cfg);
  return {
    svg: [
      svgRect(x, y, w, h, cfg.colors.callFill, cfg.colors.border),
      svgLine(x + BAR_W, y, x + BAR_W, y + h, cfg.colors.border),
      svgLine(x + w - BAR_W, y, x + w - BAR_W, y + h, cfg.colors.border),
      svgCentredText(x + w / 2, y + h / 2, label, w - BAR_W * 2, cfg),
    ].join('\n'),
    height: h,
  };
}

// ── Terminator — return / break / exit (notched polygon) ──────────────────────

function renderTerminator(label: string, x: number, y: number, w: number, cfg: ResolvedConfig): Rendered {
  const h = rowHeight(label, w, cfg);
  const notch = Math.min(10, Math.floor(h / 3));
  // Hexagonal polygon: small triangular cuts at the two bottom corners.
  const pts: Array<[number, number]> = [
    [x, y],
    [x + w, y],
    [x + w, y + h - notch],
    [x + w - notch, y + h],
    [x + notch, y + h],
    [x, y + h - notch],
  ];
  return {
    svg: [
      svgPolygon(pts, cfg.colors.exitFill, cfg.colors.border),
      svgCentredText(x + w / 2, y + h / 2, label, w, cfg),
    ].join('\n'),
    height: h,
  };
}

// ── If / else-if / else ───────────────────────────────────────────────────────
//
// NSD conditional: the condition row contains two diagonals that form a V (▽).
// The diagonals run from the top-left and top-right corners down to a
// bottom-centre apex, creating three regions:
//   • large upper triangle  → condition text  (top of block)
//   • lower-left triangle   → "Y" label       (true / then branch)
//   • lower-right triangle  → "N" label       (false / else branch)
// Below the condition row the available width is split 50/50 for the two
// branches.  else-if chains are rendered as nested ifs inside the else column.
// Empty branches render as plain background with no placeholder box.

function renderIf(node: IfNode, x: number, y: number, w: number, cfg: ResolvedConfig): Rendered {
  // Flatten else-if chain into nested IfNodes (innermost first).
  let elseBody: Block = node.elseBranch ?? [];
  for (let i = node.elseIfBranches.length - 1; i >= 0; i--) {
    const branch = node.elseIfBranches[i]!;
    const nestedIf: IfNode = {
      kind: 'if',
      condition: branch.condition,
      thenBranch: branch.body,
      elseIfBranches: [],
      elseBranch: elseBody.length > 0 ? elseBody : undefined,
    };
    elseBody = [nestedIf];
  }

  const halfW = Math.floor(w / 2);
  const otherHalf = w - halfW;

  // The condition text lives in the upper V-triangle; effective width at the
  // text centroid (y + condH/3) is approximately w * 0.6.
  const condH = Math.max(
    cfg.minRowHeight * 1.5,
    rowHeight(node.condition, w * 0.6, cfg),
  );

  // Render both branches; empty branches produce no SVG (no placeholder box).
  const thenR = node.thenBranch.length > 0
    ? renderBlock(node.thenBranch, x, y + condH, halfW, cfg)
    : { svg: '', height: 0 };
  const elseR = elseBody.length > 0
    ? renderBlock(elseBody, x + halfW, y + condH, otherHalf, cfg)
    : { svg: '', height: 0 };
  const bodyH = Math.max(cfg.minRowHeight, thenR.height, elseR.height);
  const totalH = condH + bodyH;

  // V-shape region centroids:
  //   upper triangle  (TL, TR, BC) → condition text at (w/2,   condH/3)
  //   lower-left tri  (TL, BL, BC) → Y label at         (halfW/3, 2*condH/3)
  //   lower-right tri (TR, BR, BC) → N label at         (halfW + 2*otherHalf/3, 2*condH/3)
  const condTextY = y + condH / 3;
  const labelY    = y + (condH * 2) / 3;

  return {
    svg: [
      // Condition row background (fill only — border drawn by outer rect below)
      svgRect(x, y, w, condH, cfg.colors.conditionFill, 'none'),
      // V diagonals: top-left → bottom-centre, top-right → bottom-centre
      svgLine(x,     y, x + halfW, y + condH, cfg.colors.border),
      svgLine(x + w, y, x + halfW, y + condH, cfg.colors.border),
      // Condition text in the large upper triangle
      svgCentredText(x + w / 2, condTextY, node.condition, w * 0.6, cfg),
      // Y / N labels in the lower-left / lower-right outer triangles
      svgCentredText(x + halfW / 3,                   labelY, 'Y', halfW / 2,     cfg),
      svgCentredText(x + halfW + (otherHalf * 2) / 3, labelY, 'N', otherHalf / 2, cfg),
      // Column backgrounds (fill only)
      svgRect(x,         y + condH, halfW,     bodyH, cfg.colors.processFill, 'none'),
      svgRect(x + halfW, y + condH, otherHalf, bodyH, cfg.colors.processFill, 'none'),
      // Branch content (empty branches contribute nothing)
      thenR.svg,
      elseR.svg,
      // When a branch is empty its first block would normally draw the top
      // border of the body column — add it explicitly instead.
      ...(node.thenBranch.length === 0
        ? [svgLine(x,         y + condH, x + halfW, y + condH, cfg.colors.border)]
        : []),
      ...(elseBody.length === 0
        ? [svgLine(x + halfW, y + condH, x + w,     y + condH, cfg.colors.border)]
        : []),
      // Centre divider through the body — only needed when one branch is empty,
      // because adjacent block borders provide natural separation otherwise.
      ...(node.thenBranch.length === 0 || elseBody.length === 0
        ? [svgLine(x + halfW, y + condH, x + halfW, y + totalH, cfg.colors.border)]
        : []),
      // Outer border
      svgRect(x, y, w, totalH, 'none', cfg.colors.border),
    ].join('\n'),
    height: totalH,
  };
}

// ── Switch — N-way branch ─────────────────────────────────────────────────────

function renderSwitch(node: SwitchNode, x: number, y: number, w: number, cfg: ResolvedConfig): Rendered {
  const n = node.cases.length;
  if (n === 0) return renderProcess('[empty switch]', x, y, w, cfg);

  const colWidths = splitWidth(w, n);
  const xs = columnXs(x, colWidths);

  // Expression header
  const exprLabel = `switch ${node.expression}`;
  const exprH = rowHeight(exprLabel, w, cfg);

  // Case-label row — uniform height (tallest label wins)
  const caseLabelH = Math.max(
    cfg.minRowHeight,
    ...node.cases.map((c, i) => rowHeight(c.label, colWidths[i]!, cfg)),
  );

  // Case bodies
  const bodyY = y + exprH + caseLabelH;
  const bodyResults = node.cases.map((c, i) =>
    renderBlock(c.body, xs[i]!, bodyY, colWidths[i]!, cfg),
  );
  const maxBodyH = Math.max(cfg.minRowHeight, ...bodyResults.map(r => r.height));
  const totalH = exprH + caseLabelH + maxBodyH;

  const parts: string[] = [
    svgRect(x, y, w, exprH, cfg.colors.conditionFill, cfg.colors.border),
    svgCentredText(x + w / 2, y + exprH / 2, exprLabel, w, cfg),
  ];

  for (let i = 0; i < n; i++) {
    const cx = xs[i]!;
    const cw = colWidths[i]!;
    const c = node.cases[i]!;
    const br = bodyResults[i]!;
    const labelY = y + exprH;

    parts.push(svgRect(cx, labelY, cw, caseLabelH, cfg.colors.conditionFill, cfg.colors.border));
    parts.push(svgCentredText(cx + cw / 2, labelY + caseLabelH / 2, c.label, cw, cfg));
    parts.push(svgRect(cx, bodyY, cw, maxBodyH, cfg.colors.processFill, 'none'));
    parts.push(br.svg);
  }

  parts.push(svgRect(x, y, w, totalH, 'none', cfg.colors.border));
  return { svg: parts.join('\n'), height: totalH };
}

// ── Loops ──────────────────────────────────────────────────────────────────────
//
// All loops render a containment shape to show steps are inside the loop:
//   Γ shape (while / for / loop): condition bar at top, left strip down the body
//   L shape (do-while):           left strip down the body, condition bar at bottom

const LOOP_STRIP_W = 10;

/** Pre-test loop (while / for): Γ shape — condition bar at top, left strip down body. */
function renderLoopPreTest(
  condLabel: string, body: Block,
  x: number, y: number, w: number,
  cfg: ResolvedConfig,
): Rendered {
  const condH = rowHeight(condLabel, w, cfg);
  const bodyR = renderBlock(body, x + LOOP_STRIP_W, y + condH, w - LOOP_STRIP_W, cfg);
  const totalH = condH + bodyR.height;
  return {
    svg: [
      // no stroke on the bar — outer rect + explicit lines handle all borders
      svgRect(x, y, w, condH, cfg.colors.loopFill, 'none'),
      svgCentredText(x + w / 2, y + condH / 2, condLabel, w, cfg),
      svgRect(x, y + condH, LOOP_STRIP_W, bodyR.height, cfg.colors.loopFill, 'none'),
      svgRect(x + LOOP_STRIP_W, y + condH, w - LOOP_STRIP_W, bodyR.height, cfg.colors.processFill, 'none'),
      bodyR.svg,
      // horizontal divider starts at the strip edge so the strip–bar join is seamless
      svgLine(x + LOOP_STRIP_W, y + condH, x + w, y + condH, cfg.colors.border),
      svgLine(x + LOOP_STRIP_W, y + condH, x + LOOP_STRIP_W, y + totalH, cfg.colors.border),
      svgRect(x, y, w, totalH, 'none', cfg.colors.border),
    ].join('\n'),
    height: totalH,
  };
}

/** Post-test loop (do-while): L shape — left strip down body, condition bar at bottom. */
function renderLoopPostTest(
  condLabel: string, body: Block,
  x: number, y: number, w: number,
  cfg: ResolvedConfig,
): Rendered {
  const bodyR = renderBlock(body, x + LOOP_STRIP_W, y, w - LOOP_STRIP_W, cfg);
  const condH = rowHeight(condLabel, w, cfg);
  const condY = y + bodyR.height;
  const totalH = bodyR.height + condH;
  return {
    svg: [
      svgRect(x, y, LOOP_STRIP_W, bodyR.height, cfg.colors.loopFill, 'none'),
      svgRect(x + LOOP_STRIP_W, y, w - LOOP_STRIP_W, bodyR.height, cfg.colors.processFill, 'none'),
      bodyR.svg,
      svgLine(x + LOOP_STRIP_W, y, x + LOOP_STRIP_W, condY, cfg.colors.border),
      // horizontal divider ends at the strip edge so the strip–bar join is seamless
      svgLine(x + LOOP_STRIP_W, condY, x + w, condY, cfg.colors.border),
      // no stroke on the bar — outer rect + explicit lines handle all borders
      svgRect(x, condY, w, condH, cfg.colors.loopFill, 'none'),
      svgCentredText(x + w / 2, condY + condH / 2, condLabel, w, cfg),
      svgRect(x, y, w, totalH, 'none', cfg.colors.border),
    ].join('\n'),
    height: totalH,
  };
}

/** Infinite loop: Γ shape — thin "loop" marker at top, left strip down body. */
function renderLoopInfinite(body: Block, x: number, y: number, w: number, cfg: ResolvedConfig): Rendered {
  const MARKER_H = Math.ceil(cfg.minRowHeight / 2);
  const bodyR = renderBlock(body, x + LOOP_STRIP_W, y + MARKER_H, w - LOOP_STRIP_W, cfg);
  const totalH = MARKER_H + bodyR.height;
  return {
    svg: [
      // no stroke on the marker — outer rect + explicit lines handle all borders
      svgRect(x, y, w, MARKER_H, cfg.colors.loopFill, 'none'),
      svgCentredText(x + w / 2, y + MARKER_H / 2, 'loop', w, cfg),
      svgRect(x, y + MARKER_H, LOOP_STRIP_W, bodyR.height, cfg.colors.loopFill, 'none'),
      svgRect(x + LOOP_STRIP_W, y + MARKER_H, w - LOOP_STRIP_W, bodyR.height, cfg.colors.processFill, 'none'),
      bodyR.svg,
      // horizontal divider starts at the strip edge so the strip–marker join is seamless
      svgLine(x + LOOP_STRIP_W, y + MARKER_H, x + w, y + MARKER_H, cfg.colors.border),
      svgLine(x + LOOP_STRIP_W, y + MARKER_H, x + LOOP_STRIP_W, y + totalH, cfg.colors.border),
      svgRect(x, y, w, totalH, 'none', cfg.colors.border),
    ].join('\n'),
    height: totalH,
  };
}

// ── Parallel ───────────────────────────────────────────────────────────────────

function renderParallel(node: ParallelNode, x: number, y: number, w: number, cfg: ResolvedConfig): Rendered {
  const n = node.threads.length;
  if (n === 0) return renderProcess('[empty parallel]', x, y, w, cfg);

  const colWidths = splitWidth(w, n);
  const xs = columnXs(x, colWidths);

  const headerH = rowHeight('parallel', w, cfg);
  const bodyY = y + headerH;

  const bodyResults = node.threads.map((thread, i) =>
    renderBlock(thread, xs[i]!, bodyY, colWidths[i]!, cfg),
  );
  const maxBodyH = Math.max(cfg.minRowHeight, ...bodyResults.map(r => r.height));
  const totalH = headerH + maxBodyH;

  const parts: string[] = [
    svgRect(x, y, w, headerH, cfg.colors.parallelFill, cfg.colors.border),
    svgCentredText(x + w / 2, y + headerH / 2, 'parallel', w, cfg),
  ];

  for (let i = 0; i < n; i++) {
    const cx = xs[i]!;
    const cw = colWidths[i]!;
    parts.push(svgRect(cx, bodyY, cw, maxBodyH, cfg.colors.processFill, 'none'));
    parts.push(bodyResults[i]!.svg);
    if (i < n - 1) {
      // Column divider
      parts.push(svgLine(cx + cw, bodyY, cx + cw, y + totalH, cfg.colors.border));
    }
  }

  parts.push(svgRect(x, y, w, totalH, 'none', cfg.colors.border));
  return { svg: parts.join('\n'), height: totalH };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Render a {@link DiagramAST} as a self-contained SVG string.
 *
 * The returned string:
 * - begins with `<svg` and includes `xmlns="http://www.w3.org/2000/svg"`
 * - has an explicit `viewBox` derived from the computed diagram dimensions
 * - is valid standalone SVG (safe to inline in HTML or save as `.svg`)
 * - contains no external resource references or JavaScript
 *
 * @param ast     - The parsed diagram produced by {@link parse}.
 * @param options - Optional rendering configuration.  All fields default
 *   when omitted.
 * @returns A UTF-8 SVG string representing the Nassi-Shneiderman diagram.
 *
 * @throws {StruktRenderError} When the AST contains an unrecognised node
 *   kind (e.g. from a future language revision).
 *
 * @example
 * ```ts
 * import { parse, render } from 'strukt-renderer';
 *
 * const svg = render(parse(source), { width: 800, theme: 'dark' });
 * document.getElementById('diagram')!.innerHTML = svg;
 * ```
 */
export function render(ast: DiagramAST, options?: RenderOptions): string {
  const cfg = resolveConfig(options);
  const parts: string[] = [];
  let totalH = 0;

  // Optional title bar
  if (ast.title !== undefined) {
    const h = rowHeight(ast.title, cfg.width, cfg);
    parts.push(svgRect(0, 0, cfg.width, h, cfg.colors.conditionFill, cfg.colors.border));
    parts.push(
      `<text x="${f(cfg.width / 2)}" y="${f(h / 2)}" ` +
      `text-anchor="middle" dominant-baseline="central" ` +
      `font-family="${esc(cfg.fontFamily)}" font-size="${f(cfg.fontSize + 2)}" ` +
      `font-weight="bold" fill="${cfg.colors.text}">${esc(ast.title)}</text>`,
    );
    totalH = h;
  }

  // Diagram body
  const bodyR = renderBlock(ast.body, 0, totalH, cfg.width, cfg);
  parts.push(bodyR.svg);
  totalH += bodyR.height;

  const inner = parts.join('\n');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="0 0 ${f(cfg.width)} ${f(totalH)}" ` +
    `width="${f(cfg.width)}" height="${f(totalH)}">\n` +
    `<rect width="100%" height="100%" fill="${cfg.colors.background}"/>\n` +
    `${inner}\n` +
    `</svg>`
  );
}
