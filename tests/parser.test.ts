import { describe, it, expect } from 'vitest';
import { StruktParseError } from '../src/index';
import { parse } from '../src/parser';

describe('parse()', () => {
  it('is exported as a named function', () => {
    expect(typeof parse).toBe('function');
  });

  it('throws (not yet implemented)', () => {
    expect(() => parse('x = 1')).toThrow('Not implemented');
  });

  // ── Title ──────────────────────────────────────────────────────────────────
  it.todo('returns a DiagramAST with title when `title:` is present');
  it.todo('returns undefined title when no title line is provided');
  it.todo('title is case-insensitive (`TITLE:` is accepted)');

  // ── Process statements ─────────────────────────────────────────────────────
  it.todo('parses a single process statement into a ProcessNode');
  it.todo('trims leading/trailing whitespace from process text');

  // ── Comments ───────────────────────────────────────────────────────────────
  it.todo('strips `#` comment lines — they do not appear in the AST');
  it.todo('strips `//` comment lines — they do not appear in the AST');
  it.todo('ignores blank lines between statements');

  // ── Call statements ────────────────────────────────────────────────────────
  it.todo('parses `call validateInput(x)` into a CallNode with correct text');

  // ── Exit statements ────────────────────────────────────────────────────────
  it.todo('parses `return avg` into a ReturnNode with the value text');
  it.todo('parses bare `return` into a ReturnNode with undefined value');
  it.todo('parses `break` into a BreakNode');
  it.todo('parses `exit` into an ExitNode');

  // ── If / else-if / else ────────────────────────────────────────────────────
  it.todo('parses `if … else` into an IfNode with a defined elseBranch');
  it.todo('parses `if` with no else into an IfNode with undefined elseBranch');
  it.todo('parses `else if` chains into elseIfBranches array');
  it.todo('parses `elseif` (no space) as a valid alias for `else if`');
  it.todo('nests an if block inside a while body correctly');

  // ── Switch / case ──────────────────────────────────────────────────────────
  it.todo('parses switch/case into a SwitchNode with correct case branches');
  it.todo('parses `default:` as CaseBranch with isDefault = true');
  it.todo('places default branch last in the cases array');

  // ── While ──────────────────────────────────────────────────────────────────
  it.todo('parses `while <cond>:` into a WhileNode');

  // ── Do-while ───────────────────────────────────────────────────────────────
  it.todo('parses `do: … while <cond>` into a DoWhileNode');
  it.todo('throws StruktParseError when `do:` has no matching closing `while`');

  // ── For loops ──────────────────────────────────────────────────────────────
  it.todo('parses `for i from 1 to n:` into a ForNode preserving header text');
  it.todo('parses `for each x in list:` into a ForNode (space variant)');
  it.todo('parses `foreach x in list:` into a ForNode (no-space variant)');

  // ── Infinite loop ──────────────────────────────────────────────────────────
  it.todo('parses `loop:` into a LoopNode');

  // ── Parallel / thread ──────────────────────────────────────────────────────
  it.todo('parses `parallel:` with two `thread:` blocks into a ParallelNode');
  it.todo('throws StruktParseError when `parallel:` contains no threads');

  // ── Indentation errors ─────────────────────────────────────────────────────
  it.todo('throws StruktParseError on unexpected DEDENT');
  it.todo('throws StruktParseError when tabs and spaces are mixed');
  it.todo('StruktParseError includes the 1-based line number');

  // ── Case-insensitive keywords ──────────────────────────────────────────────
  it.todo('accepts uppercase `IF` / `WHILE` / `FOR` keywords');
  it.todo('accepts mixed-case `While` / `For` keywords');

  // ── Full example ───────────────────────────────────────────────────────────
  it.todo('parses the binary-search example without errors');
  it.todo('parses the bubble-sort example without errors');
  it.todo('parses the parallel-download example without errors');
});

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
