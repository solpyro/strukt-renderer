import type {
  DiagramAST,
  Block,
  DiagramNode,
  ElseIfBranch,
  CaseBranch,
  IfNode,
  SwitchNode,
  WhileNode,
  DoWhileNode,
  ForNode,
  LoopNode,
  ParallelNode,
} from './types';
import { StruktParseError } from './errors';

// ── Internal types ────────────────────────────────────────────────────────────

interface Line {
  /** Indentation depth (0 = no indent; each level = one indent unit). */
  indent: number;
  /** Trimmed text of the line (no leading/trailing whitespace). */
  text: string;
  /** 1-based original line number (for error reporting). */
  lineNum: number;
}

// ── Preprocessing ─────────────────────────────────────────────────────────────

/**
 * Split `source` into logical {@link Line}s, stripping blank lines and
 * comment lines (`#` / `//`).
 *
 * Indentation is converted to integer depth levels.  The indent unit is
 * inferred from the first indented line (defaulting to 4 spaces).
 * Tabs count as 1 unit each.  Mixing tabs and spaces — on one line or
 * across lines in the same file — throws {@link StruktParseError}.
 */
function preprocessLines(source: string): Line[] {
  const rawLines = source.split(/\r\n|\r|\n/);
  const result: Line[] = [];
  let fileIndentChar: ' ' | '\t' | null = null;
  let spaceUnit: number | null = null; // detected from first space-indented line

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i] ?? '';
    const lineNum = i + 1;

    // Count and validate leading whitespace
    let j = 0;
    let lineChar: ' ' | '\t' | null = null;
    let count = 0;
    while (j < raw.length && (raw[j] === ' ' || raw[j] === '\t')) {
      const ch = raw[j] as ' ' | '\t';
      if (lineChar === null) lineChar = ch;
      else if (lineChar !== ch) {
        throw new StruktParseError('Mixed tabs and spaces in indentation', lineNum);
      }
      count++;
      j++;
    }

    const text = raw.slice(j).trimEnd();
    if (text === '') continue;                              // blank line
    if (text.startsWith('#') || text.startsWith('//')) continue; // comment

    // Enforce file-level indentation character consistency
    if (lineChar !== null) {
      if (fileIndentChar === null) {
        fileIndentChar = lineChar;
      } else if (fileIndentChar !== lineChar) {
        throw new StruktParseError(
          'Inconsistent indentation: mixing tabs and spaces across lines',
          lineNum,
        );
      }
      if (lineChar === ' ' && spaceUnit === null) {
        spaceUnit = count; // infer unit from first indented line
      }
    }

    const unit = lineChar === '\t' ? 1 : (spaceUnit ?? 4);
    const level = lineChar === null ? 0 : Math.floor(count / unit);
    result.push({ indent: level, text, lineNum });
  }

  return result;
}

// ── Parser ────────────────────────────────────────────────────────────────────

class Parser {
  private readonly lines: Line[];
  private pos = 0;

  constructor(lines: Line[]) {
    this.lines = lines;
  }

  // ── Cursor helpers ──────────────────────────────────────────────────────────

  private peek(): Line | undefined {
    return this.lines[this.pos];
  }

  private consume(): Line {
    const line = this.lines[this.pos];
    if (line === undefined) throw new StruktParseError('Unexpected end of input');
    this.pos++;
    return line;
  }

  // ── Top-level ───────────────────────────────────────────────────────────────

  /** Parse the complete diagram, including an optional `title:` header. */
  parseDiagram(): DiagramAST {
    let title: string | undefined;

    const first = this.peek();
    if (first !== undefined && first.indent === 0 && /^title\s*:/i.test(first.text)) {
      this.consume();
      const rest = first.text.replace(/^title\s*:\s*/i, '').trim();
      title = rest !== '' ? rest : undefined;
    }

    const body = this.parseBlock(0);

    // Any remaining content at this point is an orphaned continuation keyword
    const remaining = this.peek();
    if (remaining !== undefined) {
      const lower = remaining.text.toLowerCase();
      if (lower === 'else:' || lower.startsWith('else if ') || lower.startsWith('elseif ')) {
        throw new StruktParseError('`else` / `else if` without matching `if`', remaining.lineNum);
      }
      if (lower.startsWith('case ') || lower === 'default:') {
        throw new StruktParseError('`case` / `default` outside of a `switch` block', remaining.lineNum);
      }
      throw new StruktParseError('Unexpected content', remaining.lineNum);
    }

    return { title, body };
  }

  // ── Block parsing ───────────────────────────────────────────────────────────

  /**
   * Collect all statements at exactly `indent` depth.
   *
   * Stops when:
   * - EOF or a line at shallower indent (natural DEDENT)
   * - A continuation keyword (`else`, `else if`, `elseif`, `case`, `default`)
   *   at the same depth — the parent control-structure handler reads these.
   *
   * Throws on a line that is unexpectedly deeper than `indent`.
   */
  private parseBlock(indent: number): Block {
    const nodes: DiagramNode[] = [];

    while (true) {
      const line = this.peek();
      if (line === undefined) break;
      if (line.indent < indent) break;
      if (line.indent > indent) {
        throw new StruktParseError('Unexpected indentation', line.lineNum);
      }

      // Continuation keywords — consumed by their parent handlers, not here
      const lower = line.text.toLowerCase();
      if (lower === 'else:' || lower.startsWith('else if ') || lower.startsWith('elseif ')) break;
      if (lower.startsWith('case ') || lower === 'default:') break;

      nodes.push(this.parseStatement(indent));
    }

    return nodes;
  }

  // ── Statement dispatch ──────────────────────────────────────────────────────

  /** Dispatch one statement or control structure at `indent`. */
  private parseStatement(indent: number): DiagramNode {
    const line = this.peek();
    if (line === undefined) throw new StruktParseError('Unexpected end of input');
    const lower = line.text.toLowerCase();

    // Control structures
    if (lower.startsWith('if ') && lower.endsWith(':'))      return this.parseIf(indent);
    if (lower.startsWith('switch ') && lower.endsWith(':'))  return this.parseSwitch(indent);
    if (lower.startsWith('while ') && lower.endsWith(':'))   return this.parseWhile(indent);
    if (lower.startsWith('while ') && !lower.endsWith(':')) {
      throw new StruktParseError(
        "`while` without trailing colon found outside a `do:` block",
        line.lineNum,
      );
    }
    if (lower === 'do:')                                     return this.parseDo(indent);
    if ((lower.startsWith('for ') || lower.startsWith('foreach ')) && lower.endsWith(':')) {
      return this.parseFor(indent);
    }
    if (lower === 'loop:')                                   return this.parseLoop(indent);
    if (lower === 'parallel:')                               return this.parseParallel(indent);

    // Leaf statements
    if (lower.startsWith('call ')) {
      this.consume();
      return { kind: 'call', text: line.text.slice('call '.length).trim() };
    }
    if (lower === 'return' || lower.startsWith('return ')) {
      this.consume();
      const value = line.text.slice('return'.length).trim();
      return { kind: 'return', value: value !== '' ? value : undefined };
    }
    if (lower === 'break') { this.consume(); return { kind: 'break' }; }
    if (lower === 'exit')  { this.consume(); return { kind: 'exit' }; }

    // Default: plain process block
    this.consume();
    return { kind: 'process', text: line.text };
  }

  // ── Control-structure parsers ───────────────────────────────────────────────

  private parseIf(indent: number): IfNode {
    const line = this.consume();
    const condition = line.text.slice('if '.length, -1).trim();
    const thenBranch = this.parseBlock(indent + 1);
    const elseIfBranches: ElseIfBranch[] = [];
    let elseBranch: Block | undefined;

    while (true) {
      const next = this.peek();
      if (next === undefined || next.indent !== indent) break;
      const lower = next.text.toLowerCase();

      if (lower.startsWith('else if ') && lower.endsWith(':')) {
        this.consume();
        const cond = next.text.slice('else if '.length, -1).trim();
        elseIfBranches.push({ condition: cond, body: this.parseBlock(indent + 1) });
      } else if (lower.startsWith('elseif ') && lower.endsWith(':')) {
        this.consume();
        const cond = next.text.slice('elseif '.length, -1).trim();
        elseIfBranches.push({ condition: cond, body: this.parseBlock(indent + 1) });
      } else if (lower === 'else:') {
        this.consume();
        elseBranch = this.parseBlock(indent + 1);
        break; // else is always the final clause
      } else {
        break;
      }
    }

    return { kind: 'if', condition, thenBranch, elseIfBranches, elseBranch };
  }

  private parseSwitch(indent: number): SwitchNode {
    const line = this.consume();
    const expression = line.text.slice('switch '.length, -1).trim();
    const cases: CaseBranch[] = [];

    while (true) {
      const next = this.peek();
      if (next === undefined || next.indent !== indent + 1) break;
      const lower = next.text.toLowerCase();

      if (lower.startsWith('case ') && lower.endsWith(':')) {
        this.consume();
        const label = next.text.slice('case '.length, -1).trim();
        cases.push({ label, isDefault: false, body: this.parseBlock(indent + 2) });
      } else if (lower === 'default:') {
        this.consume();
        cases.push({ label: 'default', isDefault: true, body: this.parseBlock(indent + 2) });
        break; // default is always the final arm
      } else {
        break;
      }
    }

    return { kind: 'switch', expression, cases };
  }

  private parseWhile(indent: number): WhileNode {
    const line = this.consume();
    const condition = line.text.slice('while '.length, -1).trim();
    return { kind: 'while', condition, body: this.parseBlock(indent + 1) };
  }

  private parseDo(indent: number): DoWhileNode {
    const doLine = this.consume();
    const body = this.parseBlock(indent + 1);

    const next = this.peek();
    if (next === undefined || next.indent !== indent) {
      throw new StruktParseError(
        '`do:` block is missing its closing `while <condition>`',
        doLine.lineNum,
      );
    }
    const lower = next.text.toLowerCase();
    if (!lower.startsWith('while ') || lower.endsWith(':')) {
      throw new StruktParseError(
        'Expected closing `while <condition>` (no trailing colon) after `do:` body',
        next.lineNum,
      );
    }
    this.consume();
    const condition = next.text.slice('while '.length).trim();
    return { kind: 'do-while', condition, body };
  }

  private parseFor(indent: number): ForNode {
    const line = this.consume();
    const lower = line.text.toLowerCase();

    // Strip the leading keyword variant, then strip the trailing colon
    let header: string;
    if (lower.startsWith('foreach ')) {
      header = line.text.slice('foreach '.length, -1).trim();
    } else if (lower.startsWith('for each ')) {
      header = line.text.slice('for each '.length, -1).trim();
    } else {
      header = line.text.slice('for '.length, -1).trim();
    }

    return { kind: 'for', header, body: this.parseBlock(indent + 1) };
  }

  private parseLoop(indent: number): LoopNode {
    this.consume();
    return { kind: 'loop', body: this.parseBlock(indent + 1) };
  }

  private parseParallel(indent: number): ParallelNode {
    const headLine = this.consume();
    const threads: Block[] = [];

    while (true) {
      const next = this.peek();
      if (next === undefined || next.indent !== indent + 1) break;
      if (next.text.toLowerCase() !== 'thread:') break;
      this.consume();
      threads.push(this.parseBlock(indent + 2));
    }

    if (threads.length === 0) {
      throw new StruktParseError(
        '`parallel:` block must contain at least one `thread:` block',
        headLine.lineNum,
      );
    }

    return { kind: 'parallel', threads };
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a Strukt source string into a {@link DiagramAST}.
 *
 * The parser:
 * - normalises line endings to `\n`
 * - strips comment lines (`#` and `//`)
 * - ignores blank lines
 * - resolves indentation into INDENT / DEDENT tokens
 * - builds a fully typed AST matching the Strukt BNF grammar
 *
 * @param source - Raw Strukt pseudocode.  Any line-ending convention is
 *   accepted (`\n`, `\r\n`, `\r`).
 * @returns The root {@link DiagramAST} for the diagram.
 *
 * @throws {StruktParseError} When the source is syntactically invalid —
 *   e.g. mismatched indentation, unknown keyword usage, or a `do:` block
 *   with no matching closing `while`.
 *
 * @example
 * ```ts
 * import { parse } from 'strukt-renderer';
 *
 * const ast = parse(`
 *   title: Find Max
 *   set max to list[0]
 *   for each value in list:
 *     if value > max:
 *       max = value
 *   return max
 * `);
 * ```
 */
export function parse(source: string): DiagramAST {
  const lines = preprocessLines(source);
  const parser = new Parser(lines);
  return parser.parseDiagram();
}
