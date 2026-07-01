import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { StruktParseError } from '../src/index';
import { parse } from '../src/parser';
import type { IfNode, SwitchNode, WhileNode, DoWhileNode, ForNode, LoopNode, ParallelNode } from '../src/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(__dirname, 'examples');

function readExample(name: string): string {
  return readFileSync(join(examplesDir, `${name}.strukt`), 'utf-8');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('parse()', () => {
  it('is exported as a named function', () => {
    expect(typeof parse).toBe('function');
  });

  // ── Title ──────────────────────────────────────────────────────────────────

  it('returns a DiagramAST with title when `title:` is present', () => {
    const ast = parse('title: Compute Average Grade');
    expect(ast.title).toBe('Compute Average Grade');
    expect(ast.body).toHaveLength(0);
  });

  it('returns undefined title when no title line is provided', () => {
    const ast = parse('x = 1');
    expect(ast.title).toBeUndefined();
  });

  it('title is case-insensitive (`TITLE:` is accepted)', () => {
    const ast = parse('TITLE: My Algorithm');
    expect(ast.title).toBe('My Algorithm');
  });

  // ── Process statements ─────────────────────────────────────────────────────

  it('parses a single process statement into a ProcessNode', () => {
    const ast = parse('initialise sum to 0');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toEqual({ kind: 'process', text: 'initialise sum to 0' });
  });

  it('trims trailing whitespace from process text', () => {
    const ast = parse('result = sum / count   ');
    expect(ast.body[0]).toEqual({ kind: 'process', text: 'result = sum / count' });
  });

  // ── Comments ───────────────────────────────────────────────────────────────

  it('strips `#` comment lines — they do not appear in the AST', () => {
    const ast = parse('# This is a comment\nx = 1');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toEqual({ kind: 'process', text: 'x = 1' });
  });

  it('strips `//` comment lines — they do not appear in the AST', () => {
    const ast = parse('// This is a comment\nx = 1');
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toEqual({ kind: 'process', text: 'x = 1' });
  });

  it('ignores blank lines between statements', () => {
    const ast = parse('x = 1\n\ny = 2\n\nz = 3');
    expect(ast.body).toHaveLength(3);
  });

  // ── Call statements ────────────────────────────────────────────────────────

  it('parses `call validateInput(x)` into a CallNode with correct text', () => {
    const ast = parse('call validateInput(x)');
    expect(ast.body[0]).toEqual({ kind: 'call', text: 'validateInput(x)' });
  });

  // ── Exit statements ────────────────────────────────────────────────────────

  it('parses `return avg` into a ReturnNode with the value text', () => {
    const ast = parse('return avg');
    expect(ast.body[0]).toEqual({ kind: 'return', value: 'avg' });
  });

  it('parses bare `return` into a ReturnNode with undefined value', () => {
    const ast = parse('return');
    expect(ast.body[0]).toMatchObject({ kind: 'return' });
    expect((ast.body[0] as ReturnNode).value).toBeUndefined();
  });

  it('parses `break` into a BreakNode', () => {
    const ast = parse('break');
    expect(ast.body[0]).toEqual({ kind: 'break' });
  });

  it('parses `exit` into an ExitNode', () => {
    const ast = parse('exit');
    expect(ast.body[0]).toEqual({ kind: 'exit' });
  });

  // ── If / else-if / else ────────────────────────────────────────────────────

  it('parses `if … else` into an IfNode with a defined elseBranch', () => {
    const src = 'if x > 0:\n    positive\nelse:\n    not positive';
    const ast = parse(src);
    expect(ast.body).toHaveLength(1);
    expect(ast.body[0]).toMatchObject({
      kind: 'if',
      condition: 'x > 0',
      thenBranch: [{ kind: 'process', text: 'positive' }],
      elseBranch: [{ kind: 'process', text: 'not positive' }],
      elseIfBranches: [],
    });
  });

  it('parses `if` with no else into an IfNode with undefined elseBranch', () => {
    const src = 'if x > 0:\n    positive';
    const ast = parse(src);
    const node = ast.body[0] as IfNode;
    expect(node.kind).toBe('if');
    expect(node.condition).toBe('x > 0');
    expect(node.thenBranch).toEqual([{ kind: 'process', text: 'positive' }]);
    expect(node.elseBranch).toBeUndefined();
    expect(node.elseIfBranches).toHaveLength(0);
  });

  it('parses `else if` chains into elseIfBranches array', () => {
    const src = [
      'if score >= 90:',
      '    grade = "A"',
      'else if score >= 75:',
      '    grade = "B"',
      'else:',
      '    grade = "F"',
    ].join('\n');
    const ast = parse(src);
    const node = ast.body[0] as IfNode;
    expect(node.kind).toBe('if');
    expect(node.condition).toBe('score >= 90');
    expect(node.elseIfBranches).toHaveLength(1);
    expect(node.elseIfBranches[0]).toMatchObject({
      condition: 'score >= 75',
      body: [{ kind: 'process', text: 'grade = "B"' }],
    });
    expect(node.elseBranch).toEqual([{ kind: 'process', text: 'grade = "F"' }]);
  });

  it('parses `elseif` (no space) as a valid alias for `else if`', () => {
    const src = 'if a:\n    x\nelseif b:\n    y\nelse:\n    z';
    const ast = parse(src);
    const node = ast.body[0] as IfNode;
    expect(node.elseIfBranches).toHaveLength(1);
    expect(node.elseIfBranches[0]?.condition).toBe('b');
  });

  it('nests an if block inside a while body correctly', () => {
    const src = [
      'while x > 0:',
      '    if x > 10:',
      '        x = x - 10',
      '    x = x - 1',
    ].join('\n');
    const ast = parse(src);
    const whileNode = ast.body[0] as WhileNode;
    expect(whileNode.kind).toBe('while');
    expect(whileNode.body).toHaveLength(2);
    expect(whileNode.body[0]).toMatchObject({ kind: 'if', condition: 'x > 10' });
    expect(whileNode.body[1]).toEqual({ kind: 'process', text: 'x = x - 1' });
  });

  // ── Switch / case ──────────────────────────────────────────────────────────

  it('parses switch/case into a SwitchNode with correct case branches', () => {
    const src = [
      'switch day of week:',
      '    case Monday:',
      '        start weekly report',
      '    case Friday:',
      '        send summary email',
    ].join('\n');
    const ast = parse(src);
    const node = ast.body[0] as SwitchNode;
    expect(node.kind).toBe('switch');
    expect(node.expression).toBe('day of week');
    expect(node.cases).toHaveLength(2);
    expect(node.cases[0]).toMatchObject({
      label: 'Monday',
      isDefault: false,
      body: [{ kind: 'process', text: 'start weekly report' }],
    });
    expect(node.cases[1]).toMatchObject({ label: 'Friday', isDefault: false });
  });

  it('parses `default:` as CaseBranch with isDefault = true', () => {
    const src = [
      'switch x:',
      '    case 1:',
      '        do A',
      '    default:',
      '        do B',
    ].join('\n');
    const ast = parse(src);
    const node = ast.body[0] as SwitchNode;
    const def = node.cases.find(c => c.isDefault);
    expect(def).toBeDefined();
    expect(def?.isDefault).toBe(true);
    expect(def?.label).toBe('default');
  });

  it('places default branch last in the cases array', () => {
    const src = [
      'switch x:',
      '    case A:',
      '        do A',
      '    case B:',
      '        do B',
      '    default:',
      '        do default',
    ].join('\n');
    const ast = parse(src);
    const node = ast.body[0] as SwitchNode;
    expect(node.cases).toHaveLength(3);
    expect(node.cases[2]?.isDefault).toBe(true);
  });

  // ── While ──────────────────────────────────────────────────────────────────

  it('parses `while <cond>:` into a WhileNode', () => {
    const src = 'while queue is not empty:\n    dequeue next item\n    process item';
    const ast = parse(src);
    const node = ast.body[0] as WhileNode;
    expect(node.kind).toBe('while');
    expect(node.condition).toBe('queue is not empty');
    expect(node.body).toHaveLength(2);
    expect(node.body[0]).toEqual({ kind: 'process', text: 'dequeue next item' });
  });

  // ── Do-while ───────────────────────────────────────────────────────────────

  it('parses `do: … while <cond>` into a DoWhileNode', () => {
    const src = [
      'do:',
      '    read next line',
      '    parse line into tokens',
      'while more lines remain',
    ].join('\n');
    const ast = parse(src);
    const node = ast.body[0] as DoWhileNode;
    expect(node.kind).toBe('do-while');
    expect(node.condition).toBe('more lines remain');
    expect(node.body).toHaveLength(2);
    expect(node.body[0]).toEqual({ kind: 'process', text: 'read next line' });
  });

  it('throws StruktParseError when `do:` has no matching closing `while`', () => {
    const src = 'do:\n    x = x + 1';
    expect(() => parse(src)).toThrow(StruktParseError);
  });

  // ── For loops ──────────────────────────────────────────────────────────────

  it('parses `for i from 1 to n:` into a ForNode preserving header text', () => {
    const src = 'for i from 1 to n:\n    sum = sum + values[i]';
    const ast = parse(src);
    const node = ast.body[0] as ForNode;
    expect(node.kind).toBe('for');
    expect(node.header).toBe('i from 1 to n');
    expect(node.body).toHaveLength(1);
  });

  it('parses `for each x in list:` into a ForNode (space variant)', () => {
    const src = 'for each student in class:\n    calculate grade';
    const ast = parse(src);
    const node = ast.body[0] as ForNode;
    expect(node.kind).toBe('for');
    expect(node.header).toBe('student in class');
  });

  it('parses `foreach x in list:` into a ForNode (no-space variant)', () => {
    const src = 'foreach item in list:\n    process item';
    const ast = parse(src);
    const node = ast.body[0] as ForNode;
    expect(node.kind).toBe('for');
    expect(node.header).toBe('item in list');
  });

  // ── Infinite loop ──────────────────────────────────────────────────────────

  it('parses `loop:` into a LoopNode', () => {
    const src = 'loop:\n    wait for event\n    dispatch event handler';
    const ast = parse(src);
    const node = ast.body[0] as LoopNode;
    expect(node.kind).toBe('loop');
    expect(node.body).toHaveLength(2);
  });

  // ── Parallel / thread ──────────────────────────────────────────────────────

  it('parses `parallel:` with two `thread:` blocks into a ParallelNode', () => {
    const src = [
      'parallel:',
      '    thread:',
      '        download file A',
      '        checksum file A',
      '    thread:',
      '        download file B',
      '        checksum file B',
    ].join('\n');
    const ast = parse(src);
    const node = ast.body[0] as ParallelNode;
    expect(node.kind).toBe('parallel');
    expect(node.threads).toHaveLength(2);
    expect(node.threads[0]).toHaveLength(2);
    expect(node.threads[0]?.[0]).toEqual({ kind: 'process', text: 'download file A' });
    expect(node.threads[1]?.[0]).toEqual({ kind: 'process', text: 'download file B' });
  });

  it('throws StruktParseError when `parallel:` contains no threads', () => {
    const src = 'parallel:\n    do some work';
    expect(() => parse(src)).toThrow(StruktParseError);
  });

  // ── Indentation errors ─────────────────────────────────────────────────────

  it('throws StruktParseError on unexpected indentation at top level', () => {
    // A line indented at level 1 with no enclosing control structure
    expect(() => parse('    x = 1')).toThrow(StruktParseError);
  });

  it('throws StruktParseError when tabs and spaces are mixed on the same line', () => {
    expect(() => parse('\t x = 1')).toThrow(StruktParseError);
  });

  it('throws StruktParseError when tabs and spaces are mixed across lines', () => {
    const src = 'if x:\n    y = 1\nif z:\n\tw = 2';
    expect(() => parse(src)).toThrow(StruktParseError);
  });

  it('StruktParseError includes the 1-based line number', () => {
    try {
      parse('x = 1\n\n    bad indent here');
      expect.fail('expected StruktParseError');
    } catch (err) {
      expect(err).toBeInstanceOf(StruktParseError);
      expect((err as StruktParseError).line).toBe(3);
    }
  });

  // ── Case-insensitive keywords ──────────────────────────────────────────────

  it('accepts uppercase `IF` / `WHILE` / `FOR` keywords', () => {
    const src = [
      'IF x > 0:',
      '    WHILE x < 10:',
      '        FOR i FROM 1 TO x:',
      '            process i',
    ].join('\n');
    expect(() => parse(src)).not.toThrow();
    const ifNode = parse(src).body[0] as IfNode;
    expect(ifNode.kind).toBe('if');
    expect(ifNode.condition).toBe('x > 0');
  });

  it('accepts mixed-case `While` / `For` keywords', () => {
    const src = 'While x > 0:\n    For i from 1 to x:\n        work';
    expect(() => parse(src)).not.toThrow();
    const w = parse(src).body[0] as WhileNode;
    expect(w.kind).toBe('while');
    expect(w.condition).toBe('x > 0');
  });

  // ── Full examples ──────────────────────────────────────────────────────────

  it('parses the binary-search example without errors', () => {
    const src = readExample('binary-search');
    expect(() => parse(src)).not.toThrow();
    const ast = parse(src);
    expect(ast.title).toBe('Binary Search');
    // Top-level structure: 3 process nodes + 1 while + 1 return
    expect(ast.body).toHaveLength(5);
    expect(ast.body[3]).toMatchObject({ kind: 'while', condition: 'low <= high' });
    expect(ast.body[4]).toMatchObject({ kind: 'return', value: 'result' });
  });

  it('parses the bubble-sort example without errors', () => {
    const src = readExample('bubble-sort');
    expect(() => parse(src)).not.toThrow();
    const ast = parse(src);
    expect(ast.title).toBe('Bubble Sort');
    // Outer for, then return
    const outerFor = ast.body[1] as ForNode;
    expect(outerFor.kind).toBe('for');
    // Inner for inside outer for's body
    expect(outerFor.body[0]).toMatchObject({ kind: 'for' });
  });

  it('parses the parallel-download example without errors', () => {
    const src = readExample('parallel-download');
    expect(() => parse(src)).not.toThrow();
    const ast = parse(src);
    expect(ast.title).toBe('Parallel File Download and Verify');
    const parallel = ast.body[0] as ParallelNode;
    expect(parallel.kind).toBe('parallel');
    expect(parallel.threads).toHaveLength(3);
    // Statement after the parallel block
    expect(ast.body[1]).toMatchObject({ kind: 'call', text: 'reportResults()' });
  });
});

// ── ReturnNode type helper ────────────────────────────────────────────────────

interface ReturnNode { kind: 'return'; value: string | undefined }

// ── StruktParseError ──────────────────────────────────────────────────────────

describe('StruktParseError', () => {
  it('is an instance of Error', () => {
    const err = new StruktParseError('bad input');
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "StruktParseError"', () => {
    expect(new StruktParseError('x').name).toBe('StruktParseError');
  });

  it('embeds the line number in the message when provided', () => {
    const err = new StruktParseError('unexpected token', 7);
    expect(err.message).toContain('7');
    expect(err.line).toBe(7);
  });

  it('has undefined line when no line is provided', () => {
    expect(new StruktParseError('x').line).toBeUndefined();
  });
});
