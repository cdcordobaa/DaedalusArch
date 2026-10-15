import type { NodeType, EdgeType, V13EdgeType, Apg2NodeType, Apg2EdgeType } from './enums.js';

export interface APGNode {
  readonly id: string;
  readonly type: NodeType | Apg2NodeType;
  readonly filePath: string;
  readonly name: string;
  layer?: string;
  role?: string;
  readonly decorators: readonly string[];
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface APGEdge {
  readonly id: string;
  readonly type: EdgeType | V13EdgeType | Apg2EdgeType;
  readonly sourceId: string;
  readonly targetId: string;
  readonly properties: Readonly<Record<string, unknown>>;
}

// Typed view of APGEdge.properties for IMPORTS edges after merging (FR-10). Not produced in U0.
export interface ImportEdgeProperties {
  readonly specifier: string;
  readonly specifiers: readonly string[];
  readonly line: number;
  readonly lines: readonly number[];
  readonly isTypeOnly: boolean;
  readonly importedNames: readonly string[];
  /** v1.3 `dynamicImports` option only: true when every occurrence is an `import()` / `require()` call. Absent otherwise. */
  readonly dynamic?: true;
  /**
   * v1.3 `reExportEdges: 'both'` only (ADR-V13-01). The RESOLVED edge to the file that declares the imported name(s),
   * present only because the specifier's file re-exports them: true when every occurrence reaches this target
   * through a re-export. Literal-view templates exclude these edges. Absent otherwise.
   */
  readonly viaReExport?: true;
  /** With `viaReExport`: the re-export files crossed, import side first (relative paths, sorted unique per edge). */
  readonly reExportBarrels?: readonly string[];
  /**
   * v1.3 `reExportEdges: 'both'` only. The LITERAL edge to the file the specifier resolves to, true when every name
   * on it is re-exported (not declared) there, so the `'resolved-only'` graph has no such edge. Resolved-view
   * templates exclude these edges. Absent otherwise.
   */
  readonly reExportHop?: true;
}

// Typed view of APGEdge.properties for RE_EXPORTS edges (FR-34). Not produced in U0.
export interface ReExportEdgeProperties {
  readonly specifier: string;
  readonly specifiers: readonly string[];
  readonly line: number;
  readonly lines: readonly number[];
  readonly exportedNames: readonly string[]; // ['*'] for `export * from`
  readonly isTypeOnly: boolean; // true only when every contributing statement is type-only
}

// Typed view of APGEdge.properties for FLOWS_TO edges (FR-21). Not produced in U0.
export interface FlowsToEdgeProperties {
  readonly field: string;
  readonly via: 'new' | 'field-assignment';
  readonly line: number;
}

// Typed view of APGNode.properties for Package nodes (FR-09). Not produced in U0.
export interface PackageNodeProperties {
  readonly scope: 'npm' | 'node' | `@${string}`;
}

// Import resolution counts (FR-14, FR-34). All zero until U2 resolves imports.
export interface ImportResolutionStats {
  readonly resolvedInternal: number;   // import statements resolved to project files
  readonly external: number;           // statements mapped to Package nodes
  readonly unresolved: number;         // project-intended statements (relative or alias) that resolve to no file
  readonly unsupportedDynamic: number; // import() and require() occurrences, not modelled
  readonly externalOutOfRootAlias: number; // subset of external: statements whose specifier was an alias resolving outside the project root and outside node_modules
  readonly droppedNoFileNode: number; // statements whose every target is a file without a File node
}

export interface APGResult {
  readonly nodes: readonly APGNode[];
  readonly edges: readonly APGEdge[];
  readonly parseCoverage: ParseCoverage;
  readonly warnings: readonly ExtractorWarning[];
  readonly importResolution: ImportResolutionStats;
  /** FLOWS_TO store accounting of the extraction (ADR-021 SO2; audit SO2-4). Not part of the report. */
  readonly flowsTo?: FlowsToStats;
  /** APG v2 accounting (`apg2` extractor option only; absent otherwise). See `src/apg-extractor/apg2/index.ts`. */
  readonly apg2?: Apg2Stats;
}

/** APG v2 accounting, per enrichment (`Docs/v1.3/apg2-design.md`). */
export interface Apg2Stats {
  readonly signatureUses: number;
  readonly components: number;
  readonly componentSource: 'declared' | 'folders';
  readonly dependsOn: number;
  readonly deepImports: number;
  readonly exportsSymbol: number;
  readonly channels: number;
  /** PUBLISHES and SUBSCRIBES edges, and the calls / decorators skipped for a computed channel name. */
  readonly async: { readonly publishes: number; readonly subscribes: number; readonly dynamicNames: number };
  /** I/O call sites per category (not edges: several sites of one owner and category make one edge). */
  readonly io: { readonly byCategory: Readonly<Record<string, number>> };
  /** Wall time of each pass, ms. */
  readonly timingsMs: Readonly<Record<'typeFlow' | 'components' | 'async' | 'io', number>>;
}

/**
 * FLOWS_TO store accounting (ADR-021 SO2; audit SO2-4): every store the D8 scope considers (BR-U2-27..29),
 * by outcome. `stores = candidates + skippedUnionOrIntersection + skippedUnextractedTarget + skippedSelfLoop`;
 * `edges` counts the edges kept after the one-edge-per-target rule, so `edges <= candidates`.
 */
export interface FlowsToStats {
  readonly stores: number;
  readonly candidates: number;
  readonly skippedUnionOrIntersection: number;
  readonly skippedUnextractedTarget: number;
  readonly skippedSelfLoop: number;
  readonly edges: number;
}

export interface ParseCoverage {
  readonly total: number;
  readonly parsed: number;
  readonly percentage: number;
  readonly skipped: readonly SkippedFile[];
}

export interface SkippedFile {
  readonly filePath: string;
  readonly reason: string;
}

export interface ExtractorWarning {
  readonly filePath: string;
  readonly message: string;
  readonly code: string;
  /** Present only as `'info'`: the warning records a decision, not a lost fact (v1.3 F-P01-ALIAS). */
  readonly severity?: 'info';
}
