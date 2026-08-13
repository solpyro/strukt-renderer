import { describe, it, expect, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { struktToSvg, StruktParseError, StruktRenderError } from '../src/index';
import type { DiagramAST } from '../src/index';
import { render } from '../src/renderer';
import * as rendererModule from '../src/renderer';

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

const withCall: DiagramAST = {
  title: undefined,
  body: [{ kind: 'call', text: 'validateInput(data)' }],
};

const withReturn: DiagramAST = {
  title: undefined,
  body: [{ kind: 'return', value: 'result' }],
};

const withBreak: DiagramAST = {
  title: undefined,
  body: [{ kind: 'break' }],
};

const withExit: DiagramAST = {
  title: undefined,
  body: [{ kind: 'exit' }],
};

const withIf: DiagramAST = {
  title: undefined,
  body: [{
    kind: 'if',
    condition: 'x > 0',
    thenBranch: [{ kind: 'process', text: 'positive path' }],
    elseIfBranches: [],
    elseBranch: [{ kind: 'process', text: 'non-positive path' }],
  }],
};

const withElseIf: DiagramAST = {
  title: undefined,
  body: [{
    kind: 'if',
    condition: 'x > 0',
    thenBranch: [{ kind: 'process', text: 'positive' }],
    elseIfBranches: [{ condition: 'x === 0', body: [{ kind: 'process', text: 'zero' }] }],
    elseBranch: [{ kind: 'process', text: 'negative' }],
  }],
};

const withSwitch: DiagramAST = {
  title: undefined,
  body: [{
    kind: 'switch',
    expression: 'day',
    cases: [
      { label: 'Monday',  isDefault: false, body: [{ kind: 'process', text: 'start report' }] },
      { label: 'Friday',  isDefault: false, body: [{ kind: 'process', text: 'send summary' }] },
      { label: 'default', isDefault: true,  body: [{ kind: 'process', text: 'continue' }] },
    ],
  }],
};

const withWhile: DiagramAST = {
  title: undefined,
  body: [{
    kind: 'while',
    condition: 'queue is not empty',
    body: [{ kind: 'process', text: 'process item' }],
  }],
};

const withDoWhile: DiagramAST = {
  title: undefined,
  body: [{
    kind: 'do-while',
    condition: 'more lines remain',
    body: [{ kind: 'process', text: 'read next line' }],
  }],
};

const withFor: DiagramAST = {
  title: undefined,
  body: [{
    kind: 'for',
    header: 'i from 1 to n',
    body: [{ kind: 'process', text: 'sum = sum + i' }],
  }],
};

const withLoop: DiagramAST = {
  title: undefined,
  body: [{
    kind: 'loop',
    body: [{ kind: 'process', text: 'wait for event' }],
  }],
};

const withParallel: DiagramAST = {
  title: undefined,
  body: [{
    kind: 'parallel',
    threads: [
      [{ kind: 'process', text: 'download file A' }],
      [{ kind: 'process', text: 'download file B' }],
    ],
  }],
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
  it('returns a string that starts with "<svg"', () => {
    expect(render(singleProcess)).toMatch(/^<svg/);
  });

  it('includes xmlns="http://www.w3.org/2000/svg"', () => {
    expect(render(singleProcess)).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('includes a non-empty viewBox attribute', () => {
    expect(render(singleProcess)).toMatch(/viewBox="[^"]+"/);
  });

  it('is parseable as valid XML', () => {
    expect(render(singleProcess).trim()).toMatch(/^<svg[\s\S]*<\/svg>$/);
  });

  // ── Title ──────────────────────────────────────────────────────────────────
  it('includes the title text when DiagramAST.title is defined', () => {
    expect(render(withTitle)).toContain('Find Maximum Value');
  });

  it('omits title element when DiagramAST.title is undefined', () => {
    // Title bar is the only place font-weight="bold" appears.
    expect(render(singleProcess)).not.toContain('font-weight="bold"');
  });

  // ── Process nodes ──────────────────────────────────────────────────────────
  it('renders a ProcessNode as a plain filled rectangle', () => {
    expect(render(singleProcess)).toMatchSnapshot();
  });

  it('includes the process text inside the rectangle', () => {
    expect(render(singleProcess)).toContain('do something');
  });

  // ── Call nodes ─────────────────────────────────────────────────────────────
  it('renders a CallNode with double vertical bars on both sides', () => {
    expect(render(withCall)).toMatchSnapshot();
  });

  // ── Exit nodes ─────────────────────────────────────────────────────────────
  it('renders ReturnNode / BreakNode / ExitNode as notched rectangles', () => {
    expect(render(withReturn)).toMatchSnapshot();
    expect(render(withBreak)).toMatchSnapshot();
    expect(render(withExit)).toMatchSnapshot();
  });

  // ── If nodes ───────────────────────────────────────────────────────────────
  it('renders an IfNode with a diagonal condition bar', () => {
    expect(render(withIf)).toMatchSnapshot();
  });

  it('renders the then-branch in the left sub-column', () => {
    expect(render(withIf)).toContain('positive path');
  });

  it('renders the else-branch in the right sub-column', () => {
    expect(render(withIf)).toContain('non-positive path');
  });

  it('renders else-if chains by extending the condition split', () => {
    expect(render(withElseIf)).toMatchSnapshot();
  });

  // ── Switch nodes ───────────────────────────────────────────────────────────
  it('renders a SwitchNode as a rectangle split into N vertical columns', () => {
    expect(render(withSwitch)).toMatchSnapshot();
  });

  it('labels each column with its case value', () => {
    const svg = render(withSwitch);
    expect(svg).toContain('Monday');
    expect(svg).toContain('Friday');
    expect(svg).toContain('default');
  });

  // ── While nodes ────────────────────────────────────────────────────────────
  it('renders a WhileNode with the condition bar at the TOP', () => {
    expect(render(withWhile)).toMatchSnapshot();
  });

  // ── DoWhile nodes ──────────────────────────────────────────────────────────
  it('renders a DoWhileNode with the condition bar at the BOTTOM', () => {
    expect(render(withDoWhile)).toMatchSnapshot();
  });

  // ── For nodes ──────────────────────────────────────────────────────────────
  it('renders a ForNode with the iteration label at the top', () => {
    expect(render(withFor)).toMatchSnapshot();
  });

  // ── Loop nodes ─────────────────────────────────────────────────────────────
  it('renders a LoopNode with no condition bar', () => {
    expect(render(withLoop)).toMatchSnapshot();
  });

  // ── Parallel nodes ─────────────────────────────────────────────────────────
  it('renders a ParallelNode as a rectangle with N vertical columns', () => {
    expect(render(withParallel)).toMatchSnapshot();
  });

  it('renders each thread body inside its column', () => {
    const svg = render(withParallel);
    expect(svg).toContain('download file A');
    expect(svg).toContain('download file B');
  });

  // ── Dimensions ────────────────────────────────────────────────────────────
  it('uses the default width (600) when options.width is omitted', () => {
    expect(render(singleProcess)).toContain('width="600"');
  });

  it('respects a custom options.width value in the viewBox', () => {
    expect(render(singleProcess, { width: 800 })).toContain('width="800"');
  });

  it('respects options.minRowHeight for leaf node heights', () => {
    // Short text: rowHeight is dominated by minRowHeight when it is large enough.
    expect(render(singleProcess, { minRowHeight: 60 })).toContain('height="60"');
  });

  // ── Typography ────────────────────────────────────────────────────────────
  it('applies the default font-family "monospace"', () => {
    expect(render(singleProcess)).toContain('font-family="monospace"');
  });

  it('applies a custom fontFamily from options', () => {
    expect(render(singleProcess, { fontFamily: 'Arial' })).toContain('font-family="Arial"');
  });

  it('applies a custom fontSize from options', () => {
    expect(render(singleProcess, { fontSize: 20 })).toContain('font-size="20"');
  });

  // ── Theming ───────────────────────────────────────────────────────────────
  it('applies the "light" theme by default', () => {
    expect(render(singleProcess)).toContain('#f8f8f8');
  });

  it('applies the "dark" theme when options.theme is "dark"', () => {
    expect(render(singleProcess, { theme: 'dark' })).toContain('#2d2d2d');
  });

  it('overrides individual colours via options.colors', () => {
    expect(render(singleProcess, { colors: { processFill: '#abcdef' } })).toContain('#abcdef');
  });

  // ── Error handling ─────────────────────────────────────────────────────────
  it('throws StruktRenderError for an unrecognised node kind', () => {
    const badAst = { title: undefined, body: [{ kind: 'unknown-kind' }] } as unknown as DiagramAST;
    expect(() => render(badAst)).toThrow(StruktRenderError);
  });
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

  it('parses and renders a complete Strukt source string in one call', () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), 'examples', 'binary-search.strukt'),
      'utf-8',
    );
    expect(struktToSvg(source)).toMatchSnapshot();
  });

  it('passes options through to the renderer', () => {
    expect(struktToSvg('x = 1', { width: 800 })).toContain('width="800"');
  });

  it('forwards StruktParseError from parse()', () => {
    // do: without a closing while is a guaranteed parse error.
    expect(() => struktToSvg('do:\n    read line')).toThrow(StruktParseError);
  });

  it('forwards StruktRenderError from render()', () => {
    const spy = vi.spyOn(rendererModule, 'render').mockImplementationOnce(() => {
      throw new StruktRenderError('mocked', 'mock-kind');
    });
    expect(() => struktToSvg('x = 1')).toThrow(StruktRenderError);
    spy.mockRestore();
  });
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
