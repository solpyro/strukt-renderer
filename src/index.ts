// ── Types (re-exported for consumers) ───────────────────────────────────────
export type {
  // Root AST
  DiagramAST,
  // Render options
  ThemePreset,
  ColorScheme,
  RenderOptions,
} from './types';

// ── Errors ───────────────────────────────────────────────────────────────────
export { StruktParseError, StruktRenderError } from './errors';

// ── Convenience wrapper ───────────────────────────────────────────────────────
import { parse } from './parser';
import { render } from './renderer';
import type { RenderOptions } from './types';

/**
 * Parse Strukt source and render the resulting diagram in a single call.
 *
 * This is a convenience wrapper around {@link parse} followed by
 * {@link render}.  Prefer the two-step form when you need to inspect or
 * transform the AST before rendering.
 *
 * @param source  - Raw Strukt pseudocode string.
 * @param options - Optional rendering configuration.
 * @returns A self-contained SVG string.
 *
 * @throws {StruktParseError} On syntax errors in the source.
 * @throws {StruktRenderError} On rendering failures.
 *
 * @example
 * ```ts
 * import { struktToSvg } from 'strukt-renderer';
 *
 * const svg = struktToSvg(`
 *   title: Bubble Sort
 *   for i from 0 to n-1:
 *     for j from 0 to n-i-2:
 *       if array[j] > array[j+1]:
 *         swap array[j] and array[j+1]
 * `, { width: 720 });
 * ```
 */
export function struktToSvg(source: string, options?: RenderOptions): string {
  return render(parse(source), options);
}
