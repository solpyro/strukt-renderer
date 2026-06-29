/**
 * Thrown when Strukt source cannot be parsed.
 *
 * @example
 * ```ts
 * try {
 *   parse(source);
 * } catch (err) {
 *   if (err instanceof StruktParseError) {
 *     console.error(`Parse failed at line ${err.line}: ${err.message}`);
 *   }
 * }
 * ```
 */
export class StruktParseError extends Error {
  /** 1-based source line where the error was detected, or `undefined`. */
  readonly line: number | undefined;

  constructor(message: string, line?: number) {
    super(line !== undefined ? `Line ${line}: ${message}` : message);
    this.name = 'StruktParseError';
    this.line = line;
    // Restore prototype chain in transpiled (CommonJS) environments.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a valid AST cannot be rendered.
 *
 * This should only occur when the AST contains a node kind introduced
 * by a future language revision that the renderer has not yet implemented.
 *
 * @example
 * ```ts
 * try {
 *   render(ast);
 * } catch (err) {
 *   if (err instanceof StruktRenderError) {
 *     console.error(`Render failed on node "${err.nodeKind}": ${err.message}`);
 *   }
 * }
 * ```
 */
export class StruktRenderError extends Error {
  /** The `kind` of the AST node that triggered the error, or `undefined`. */
  readonly nodeKind: string | undefined;

  constructor(message: string, nodeKind?: string) {
    super(nodeKind !== undefined ? `[${nodeKind}] ${message}` : message);
    this.name = 'StruktRenderError';
    this.nodeKind = nodeKind;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
