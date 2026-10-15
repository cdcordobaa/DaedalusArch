import type { PipelineError } from '../shared/errors/domain-result.js';

// ── Public API Types ─────────────────────────────────────────────────────────

/**
 * Graph construction mode (ADR-021 SO2-5, X-2). `full` is the APG. `ast-only` is the register's
 * ablation arm: an edge-type allow-list of IMPORTS, DECLARES and CONTAINS applied to the full
 * extraction (`restrictToGraphMode`, `graph-mode.ts`). Import resolution (`paths`, `baseUrl`, barrels)
 * is kept; CALLS, EXTENDS, IMPLEMENTS, CONSTRUCTOR_INJECTS, FLOWS_TO and RE_EXPORTS are removed.
 */
export type GraphMode = 'full' | 'ast-only';
export const GRAPH_MODES: readonly GraphMode[] = Object.freeze(['full', 'ast-only']);

export interface ExtractorOptions {
  lenientMode?: boolean;        // default: true
  includeDecorators?: boolean;  // default: true
  maxBarrelDepth?: number;      // default: 10
  excludePatterns?: string[];   // additional globs beyond defaults
  graphMode?: GraphMode;        // default: 'full'
  /**
   * v1.3, ON by default on the v1.3 branch (`V13_DEFAULT_OPTIONS`); OFF in the frozen v1.2E instrument
   * (`V12E_DEFAULT_OPTIONS`). Model `import('x')` and `require('x')` calls with a string-literal argument as
   * IMPORTS edges carrying `dynamic: true`, resolved like static imports.
   */
  dynamicImports?: boolean;
  /**
   * v1.3, ON by default on the v1.3 branch; OFF in the frozen v1.2E instrument. Extract the NestJS
   * `@Module({ imports, providers, controllers, exports })` metadata as MODULE_IMPORTS, MODULE_PROVIDES and
   * MODULE_EXPORTS edges between Class nodes.
   */
  moduleWiring?: boolean;
  /**
   * v1.3 (ADR-V13-01). How an import of a name through a re-export file (a barrel) is recorded.
   * - `'resolved-only'` (the frozen v1.2E behaviour): one IMPORTS edge to the file that declares the name; the edge
   *   to the barrel is dropped unless something is declared there.
   * - `'both'` (v1.3 default): the LITERAL IMPORTS edge to the file the specifier resolves to (the barrel), marked
   *   `reExportHop: true` when every name it carries is re-exported rather than declared there, plus the RESOLVED
   *   edge to the declaring file, marked `viaReExport: true` with the barrel path(s) in `reExportBarrels`.
   * The literal view of the graph excludes `viaReExport` edges; the resolved view excludes `reExportHop` edges and
   * equals the `'resolved-only'` graph (`Docs/v1.3/edge-views.md`).
   */
  reExportEdges?: ReExportEdgesMode;
  /**
   * v1.3, ON by default on the v1.3 branch; OFF in the frozen v1.2E instrument. Write class-member facts on Class
   * nodes (field names with their readonly, static and visibility facts, get/set accessors, public mutator methods,
   * fields assigned outside the constructor) and on Method nodes (`visibility`, `assignedFields`). See
   * `member-facts.ts`; used by the v1.3 FF-DT03 value-object-immutability template.
   */
  memberFacts?: boolean;
  /**
   * v1.3 (finding F-P01-ALIAS), ON by default on the v1.3 branch; OFF in the frozen v1.2E instrument. A bare (not
   * relative) specifier that resolves through a tsconfig `paths` rule to a declaration file (`.d.ts`, `.d.mts`,
   * `.d.cts`) without a File node, such as a local stub `vendor/typeorm.d.ts` for `typeorm`, becomes an IMPORTS edge
   * to the Package named by the specifier instead of being dropped. `EXTRACTOR_008` is still emitted, with
   * `severity: 'info'`. Off: the import is dropped with `EXTRACTOR_008` (the v1.2E behaviour).
   */
  aliasDeclarationPackages?: boolean;
  /**
   * APG v2 (`Docs/v1.3/apg2-design.md`), OFF in both `V12E_DEFAULT_OPTIONS` and `V13_DEFAULT_OPTIONS`; ON in
   * `V13_APG2_OPTIONS`. Adds, after every v1.3 node and edge: SIGNATURE_USES (type flow through signatures), Component
   * nodes with BELONGS_TO / DEPENDS_ON / EXPORTS_SYMBOL / DEEP_IMPORT and Martin's metrics, Channel nodes with
   * PUBLISHES / SUBSCRIBES (async coupling), and IOCategory nodes with PERFORMS_IO. See `apg2/`.
   */
  apg2?: boolean;
  /**
   * APG v2 only: the components to build. Empty = the top-level folders under `src/` (else under the project root).
   * `componentsFromLayerModel` (`apg2/components.ts`) derives them from a spec's layers and DDD contexts.
   */
  components?: readonly ComponentDeclaration[];
}

/** APG v2: one declared component (a layer, a module, or a folder); globs are project-relative. */
export interface ComponentDeclaration {
  readonly name: string;
  readonly kind: 'layer' | 'module' | 'folder';
  /** Files that belong to the component (first matching declaration of a kind wins, in declaration order). */
  readonly include: readonly string[];
  /** Matched only when no declaration of the kind matches by `include` (a layer's file-name patterns). */
  readonly includeByName?: readonly string[];
  /** Declared public entry files. When absent, the entry files are inferred (index files at the root, barrels). */
  readonly publicApi?: readonly string[];
}

/** ADR-V13-01: see {@link ExtractorOptions.reExportEdges}. */
export type ReExportEdgesMode = 'resolved-only' | 'both';

export type ExtractorErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'TSCONFIG_NOT_FOUND'
  | 'PARSE_FAILURE'
  | 'EMPTY_PROJECT';

export interface ExtractorError extends PipelineError {
  readonly code: ExtractorErrorCode;
  readonly stage: 'apg-extractor';
  readonly critical: true;
}

// ── Internal Types (not exported from index) ─────────────────────────────────

export interface NodeLookup {
  /** nodeId → true (presence check) */
  readonly nodeIds: Set<string>;
  /** filePath → File nodeId */
  readonly fileNodes: Map<string, string>;
  /** "{name}@{filePath}" → Class/Interface nodeId */
  readonly typeNodes: Map<string, string>;
  /** "{ClassName}.{method}@{filePath}" → Method nodeId */
  readonly methodNodes: Map<string, string>;
  /** "{name}@{filePath}" → Function nodeId */
  readonly functionNodes: Map<string, string>;
}

export interface DIResolution {
  readonly parameterName: string;
  readonly typeName: string;
  readonly resolvedNodeId: string | null;
  readonly decoratorBased: boolean;
  readonly skipped: boolean;
  readonly skipReason?: string;
}

export interface DecoratorMetadata {
  readonly name: string;
  readonly arguments: string[];
}

// ── Constants ────────────────────────────────────────────────────────────────

export const DI_DECORATORS = new Set([
  'Injectable',
  'Controller',
  'Service',
  'Repository',
  'Component',
  'Provider',
  'Module',
  'Guard',
  'Interceptor',
  'Resolver',
  'Pipe',
]);

export const PRIMITIVE_TYPES = new Set([
  'string', 'number', 'boolean', 'object', 'any',
  'unknown', 'never', 'void', 'null', 'undefined', 'symbol',
  'Date', 'Map', 'Set', 'Array', 'Promise', 'Symbol',
  'RegExp', 'Error', 'WeakMap', 'WeakSet', 'WeakRef',
  'ArrayBuffer', 'Uint8Array', 'Buffer',
]);

export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/*.d.ts',
  '**/*.spec.ts',
  '**/*.test.ts',
];

/**
 * The frozen v1.2E extractor defaults: the v1.3 features are OFF. Pass these (or `dynamicImports: false,
 * moduleWiring: false, reExportEdges: 'resolved-only', memberFacts: false`) to reproduce the v1.2E instrument's graph.
 */
export const V12E_DEFAULT_OPTIONS: Readonly<Required<ExtractorOptions>> = Object.freeze({
  lenientMode: true,
  includeDecorators: true,
  maxBarrelDepth: 10,
  excludePatterns: [],
  graphMode: 'full',
  dynamicImports: false,
  moduleWiring: false,
  reExportEdges: 'resolved-only',
  memberFacts: false,
  aliasDeclarationPackages: false,
  apg2: false,
  components: [],
});

/**
 * The v1.3 extractor defaults (FR-V1, ADR-V13-01): dynamic import edges, NestJS module wiring and literal +
 * resolved re-export edges, class-member facts and Package edges for `paths` aliases onto declaration stubs
 * (F-P01-ALIAS) are ON. The flags stay, so a caller can still turn each one off explicitly.
 */
export const V13_DEFAULT_OPTIONS: Readonly<Required<ExtractorOptions>> = Object.freeze({
  ...V12E_DEFAULT_OPTIONS,
  dynamicImports: true,
  moduleWiring: true,
  reExportEdges: 'both',
  memberFacts: true,
  aliasDeclarationPackages: true,
});

/**
 * APG v2 (`Docs/v1.3/apg2-design.md`): the v1.3 defaults plus the generic architectural edges. Not the default, so
 * every v1.3 graph read by the existing templates, metrics and reports is unchanged.
 */
export const V13_APG2_OPTIONS: Readonly<Required<ExtractorOptions>> = Object.freeze({
  ...V13_DEFAULT_OPTIONS,
  apg2: true,
});

/** The defaults every extractor entry point applies on the v1.3 branch. */
export const DEFAULT_OPTIONS: Readonly<Required<ExtractorOptions>> = V13_DEFAULT_OPTIONS;
