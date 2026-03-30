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

export interface APGResult {
  readonly nodes: readonly APGNode[];
  readonly edges: readonly APGEdge[];
  readonly parseCoverage: ParseCoverage;
  readonly warnings: readonly ExtractorWarning[];
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
