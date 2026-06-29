import type { DiagramAST, RenderOptions } from './types';

/**
 * Render a {@link DiagramAST} as a self-contained SVG string.
 *
 * The returned string:
 * - begins with `<svg` and includes `xmlns="http://www.w3.org/2000/svg"`
 * - has an explicit `viewBox` derived from the computed diagram dimensions
 * - is valid standalone SVG (safe to inline in HTML or save as `.svg`)
 * - contains no external resource references or JavaScript
 *
 * Layout strategy (to be implemented in Step 2):
 * - Each node is measured independently; parent boxes grow to fit children.
 * - `width` from {@link RenderOptions} sets the total SVG width; row heights
 *   are computed from text metrics and `minRowHeight`.
 * - Colours are resolved from the `theme` preset, then merged with any
 *   `colors` overrides.
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
  void ast;
  void options;
  throw new Error('Not implemented: render()');
}
