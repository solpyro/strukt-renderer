import type { DiagramAST } from './types';

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
  void source;
  throw new Error('Not implemented: parse()');
}
