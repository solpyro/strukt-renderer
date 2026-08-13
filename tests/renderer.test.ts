import { describe, it, expect } from 'vitest';
import { struktToSvg, StruktRenderError } from '../src/index';
import type { DiagramAST } from '../src/index';
import { render } from '../src/renderer';

// ---------------------------------------------------------------------------
// Minimal hand-crafted ASTs used across multiple tests
// ---------------------------------------------------------------------------

const singleProcess: DiagramAST = {
  title: undefined,
  body: [{ kind: 'process', text: 'do something' }],
};

const withTitle: DiagramAST = {
  title: 'Find Maximum Value',
  body: [{ kind: 'process', text: 'set max to list[0]' }],
};

// ---------------------------------------------------------------------------

describe('render()', () => {
  it('is exported as a named function', () => {
    expect(typeof render).toBe('function');
  });

  it('returns an SVG string for a minimal AST', () => {
    const svg = render(singleProcess);
    expect(typeof svg).toBe('string');
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  // ── SVG structure ──────────────────────────────────────────────────────────
  it.todo('returns a string that starts with "<svg"');
  it.todo('includes xmlns="http://www.w3.org/2000/svg"');
  it.todo('includes a non-empty viewBox attribute');
  it.todo('is parseable as valid XML');

  // ── Title ──────────────────────────────────────────────────────────────────
  it.todo('includes the title text when DiagramAST.title is defined');
  it.todo('omits title element when DiagramAST.title is undefined');

  // ── Process nodes ──────────────────────────────────────────────────────────
  it.todo('renders a ProcessNode as a plain filled rectangle');
  it.todo('includes the process text inside the rectangle');

  // ── Call nodes ─────────────────────────────────────────────────────────────
  it.todo('renders a CallNode with double vertical bars on both sides');

  // ── Exit nodes ─────────────────────────────────────────────────────────────
  it.todo('renders ReturnNode / BreakNode / ExitNode as notched rectangles');

  // ── If nodes ───────────────────────────────────────────────────────────────
  it.todo('renders an IfNode with a diagonal condition bar');
  it.todo('renders the then-branch in the left sub-column');
  it.todo('renders the else-branch in the right sub-column');
  it.todo('renders else-if chains by extending the condition split');

  // ── Switch nodes ───────────────────────────────────────────────────────────
  it.todo('renders a SwitchNode as a rectangle split into N vertical columns');
  it.todo('labels each column with its case value');

  // ── While nodes ────────────────────────────────────────────────────────────
  it.todo('renders a WhileNode with the condition bar at the TOP');

  // ── DoWhile nodes ──────────────────────────────────────────────────────────
  it.todo('renders a DoWhileNode with the condition bar at the BOTTOM');

  // ── For nodes ──────────────────────────────────────────────────────────────
  it.todo('renders a ForNode with the iteration label at the top');

  // ── Loop nodes ─────────────────────────────────────────────────────────────
  it.todo('renders a LoopNode with no condition bar');

  // ── Parallel nodes ─────────────────────────────────────────────────────────
  it.todo('renders a ParallelNode as a rectangle with N vertical columns');
  it.todo('renders each thread body inside its column');

  // ── Dimensions ────────────────────────────────────────────────────────────
  it.todo('uses the default width (600) when options.width is omitted');
  it.todo('respects a custom options.width value in the viewBox');
  it.todo('respects options.minRowHeight for leaf node heights');

  // ── Typography ────────────────────────────────────────────────────────────
  it.todo('applies the default font-family "monospace"');
  it.todo('applies a custom fontFamily from options');
  it.todo('applies a custom fontSize from options');

  // ── Theming ───────────────────────────────────────────────────────────────
  it.todo('applies the "light" theme by default');
  it.todo('applies the "dark" theme when options.theme is "dark"');
  it.todo('overrides individual colours via options.colors');

  // ── Error handling ─────────────────────────────────────────────────────────
  it.todo('throws StruktRenderError for an unrecognised node kind');
});

// ---------------------------------------------------------------------------

describe('struktToSvg()', () => {
  it('is exported as a named function', () => {
    expect(typeof struktToSvg).toBe('function');
  });

  it('parses and renders a simple source string', () => {
    const svg = struktToSvg('x = 1');
    expect(svg).toMatch(/^<svg/);
    expect(svg).toContain('x = 1');
  });

  it.todo('parses and renders a complete Strukt source string in one call');
  it.todo('passes options through to the renderer');
  it.todo('forwards StruktParseError from parse()');
  it.todo('forwards StruktRenderError from render()');
});

// ---------------------------------------------------------------------------

describe('StruktRenderError', () => {
  it('is an instance of Error', () => {
    const err = new StruktRenderError('unsupported node');
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "StruktRenderError"', () => {
    expect(new StruktRenderError('x').name).toBe('StruktRenderError');
  });

  it('embeds the nodeKind in the message when provided', () => {
    const err = new StruktRenderError('unsupported', 'future-node');
    expect(err.message).toContain('future-node');
    expect(err.nodeKind).toBe('future-node');
  });

  it('has undefined nodeKind when not provided', () => {
    expect(new StruktRenderError('x').nodeKind).toBeUndefined();
  });
});
