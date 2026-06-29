// ── Primitive aliases ────────────────────────────────────────────────────────

/** Trimmed, comment-stripped text label as it appears in the source. */
export type Label = string;

/** An ordered sequence of diagram nodes forming a compound body. */
export type Block = DiagramNode[];

// ── Discriminated union of all node kinds ────────────────────────────────────

export type DiagramNode =
  // Leaf statements
  | ProcessNode
  | CallNode
  | ReturnNode
  | BreakNode
  | ExitNode
  // Control structures
  | IfNode
  | SwitchNode
  | WhileNode
  | DoWhileNode
  | ForNode
  | LoopNode
  | ParallelNode;

/** The `kind` string of any diagram node. */
export type NodeKind = DiagramNode['kind'];

// ── Leaf / statement nodes ───────────────────────────────────────────────────

/**
 * A plain process rectangle.
 * Any source line whose first token is not a reserved keyword.
 *
 * Rendered as: plain filled rectangle.
 */
export interface ProcessNode {
  kind: 'process';
  text: Label;
}

/**
 * A sub-process / subroutine call block.
 * Source syntax: `call <text>`
 *
 * Rendered as: rectangle with double vertical bars on both sides (DIN 66261).
 */
export interface CallNode {
  kind: 'call';
  /** Everything after the `call` keyword. */
  text: Label;
}

/**
 * A return/exit-point block.
 * Source syntax: `return [value]`
 *
 * Rendered as: notched / terminated rectangle.
 */
export interface ReturnNode {
  kind: 'return';
  /** Optional return value — `undefined` for bare `return`. */
  value: Label | undefined;
}

/**
 * An unconditional loop-exit block.
 * Source syntax: `break`
 *
 * Rendered as: notched / terminated rectangle.
 */
export interface BreakNode {
  kind: 'break';
}

/**
 * A program-exit block.
 * Source syntax: `exit`
 *
 * Rendered as: notched / terminated rectangle.
 */
export interface ExitNode {
  kind: 'exit';
}

// ── Control structure nodes ──────────────────────────────────────────────────

/**
 * A single `else if` arm inside an {@link IfNode}.
 */
export interface ElseIfBranch {
  condition: Label;
  body: Block;
}

/**
 * A conditional branch block for `if` / `else if` / `else` chains.
 * Source syntax:
 * ```
 * if <condition>:
 *     <block>
 * [else if <condition>:
 *     <block>]*
 * [else:
 *     <block>]
 * ```
 *
 * Rendered as: triangle-split rectangle; each `else if` extends the split
 * rightward (exact layout to be decided in Step 2 of the project).
 */
export interface IfNode {
  kind: 'if';
  condition: Label;
  thenBranch: Block;
  /** Empty array when no `else if` clauses are present. */
  elseIfBranches: ElseIfBranch[];
  /** `undefined` when no `else` clause is present. */
  elseBranch: Block | undefined;
}

/**
 * A single `case` or `default` arm inside a {@link SwitchNode}.
 */
export interface CaseBranch {
  /** The rendered label — the value string after `case`, or `"default"`. */
  label: Label;
  isDefault: boolean;
  body: Block;
}

/**
 * An N-way branch block for `switch` / `case` / `default`.
 * Source syntax:
 * ```
 * switch <expression>:
 *     case <value>:
 *         <block>
 *     default:
 *         <block>
 * ```
 *
 * Rendered as: a rectangle divided into N vertical columns.
 */
export interface SwitchNode {
  kind: 'switch';
  expression: Label;
  /** At least one entry; the `default` branch (if any) is last. */
  cases: CaseBranch[];
}

/**
 * A pre-test loop (condition checked before each iteration).
 * Source syntax:
 * ```
 * while <condition>:
 *     <block>
 * ```
 *
 * Rendered as: loop box with the condition bar at the **top**.
 */
export interface WhileNode {
  kind: 'while';
  condition: Label;
  body: Block;
}

/**
 * A post-test loop (condition checked after each iteration).
 * Source syntax:
 * ```
 * do:
 *     <block>
 * while <condition>        ← no trailing colon
 * ```
 *
 * Rendered as: loop box with the condition bar at the **bottom**.
 */
export interface DoWhileNode {
  kind: 'do-while';
  condition: Label;
  body: Block;
}

/**
 * A counting / for loop with a free-form iteration label.
 * Source syntax (all equivalent in rendering):
 * ```
 * for i from 1 to n:
 *     <block>
 *
 * for each student in class:
 *     <block>
 *
 * foreach item in list:
 *     <block>
 * ```
 *
 * Rendered as: loop box with the iteration label at the top.
 */
export interface ForNode {
  kind: 'for';
  /**
   * Everything after `for` / `for each` / `foreach` up to (not including)
   * the trailing colon.  Preserved verbatim; the renderer does not
   * interpret iteration semantics.
   */
  header: Label;
  body: Block;
}

/**
 * An infinite loop with no condition bar.
 * Source syntax:
 * ```
 * loop:
 *     <block>
 * ```
 * Exit is implied by a nested `break` or `return`.
 *
 * Rendered as: loop box with no condition bar.
 */
export interface LoopNode {
  kind: 'loop';
  body: Block;
}

/**
 * A concurrent execution block.
 * Source syntax:
 * ```
 * parallel:
 *     thread:
 *         <block>
 *     thread:
 *         <block>
 * ```
 *
 * Rendered as: a rectangle divided into N vertical columns, one per thread.
 */
export interface ParallelNode {
  kind: 'parallel';
  /** Each element is the body block of one `thread:` section. */
  threads: Block[];
}

// ── Root AST ─────────────────────────────────────────────────────────────────

/**
 * The parsed representation of a complete Strukt diagram.
 *
 * Produced by {@link parse} and consumed by {@link render}.
 */
export interface DiagramAST {
  /** Optional diagram title from `title: <text>`. */
  title: Label | undefined;
  /** Top-level sequence of diagram nodes. */
  body: Block;
}

// ── Render options ────────────────────────────────────────────────────────────

/** Built-in colour theme presets. */
export type ThemePreset = 'light' | 'dark';

/**
 * Per-element colour overrides.
 * All values must be valid CSS colour strings (hex, rgb(), named, etc.).
 */
export interface ColorScheme {
  /** Diagram background and whitespace fill. */
  background: string;
  /** Stroke / border colour used for all box outlines. */
  border: string;
  /** Default text colour for all labels. */
  text: string;
  /** Fill for plain process rectangles. */
  processFill: string;
  /** Fill for if/switch condition bars. */
  conditionFill: string;
  /** Fill for while/for/loop condition / iteration bars. */
  loopFill: string;
  /** Fill for call (sub-process) blocks. */
  callFill: string;
  /** Fill for return / break / exit terminated blocks. */
  exitFill: string;
  /** Fill for the parallel block header row. */
  parallelFill: string;
}

/**
 * Options passed to {@link render} (and {@link struktToSvg}) to control
 * the appearance and dimensions of the generated SVG.
 *
 * Every field is optional; the renderer applies sensible defaults when
 * a field is omitted.
 */
export interface RenderOptions {
  /**
   * Total width of the generated SVG in pixels.
   * @default 600
   */
  width?: number;

  /**
   * Minimum height of a single row / cell in pixels.
   * The renderer may exceed this for cells whose text wraps.
   * @default 32
   */
  minRowHeight?: number;

  /**
   * Font size in pixels.
   * @default 14
   */
  fontSize?: number;

  /**
   * CSS `font-family` string applied to all text elements.
   * @default "monospace"
   */
  fontFamily?: string;

  /**
   * Inner padding (px) between cell text and cell border.
   * @default 8
   */
  padding?: number;

  /**
   * Named colour preset applied before any `colors` overrides.
   * @default "light"
   */
  theme?: ThemePreset;

  /**
   * Per-element colour overrides.
   * Merged on top of the resolved `theme`; only supplied fields are
   * overridden.
   */
  colors?: Partial<ColorScheme>;
}
