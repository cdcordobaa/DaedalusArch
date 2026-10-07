import type { NodeType, EdgeType } from './enums.js';

export interface APGNode {
  readonly id: string;
  readonly type: NodeType;
  readonly filePath: string;
  readonly name: string;
  layer?: string;
  role?: string;
  readonly decorators: readonly string[];
  readonly properties: Readonly<Record<string, unknown>>;
}

export interface APGEdge {
  readonly id: string;
  readonly type: EdgeType;
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
}

// Typed view of APGEdge.properties for RE_EXPORTS edges (FR-34). Not produced in U0.
export interface ReExportEdgeProperties {
  readonly specifier: string;
  readonly specifiers: readonly string[];
  readonly line: number;
  readonly lines: readonly number[];
  readonly exportedNames: readonly string[]; // ['*'] for `export * from`
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
  readonly unresolved: number;         // relative statements with EXTRACTOR_002
  readonly unsupportedDynamic: number; // import() and require() occurrences, not modelled
}

export interface APGResult {
  readonly nodes: readonly APGNode[];
  readonly edges: readonly APGEdge[];
  readonly parseCoverage: ParseCoverage;
  readonly warnings: readonly ExtractorWarning[];
  readonly importResolution: ImportResolutionStats;
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
}
