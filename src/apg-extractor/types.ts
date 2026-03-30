import type { PipelineError } from '../shared/errors/domain-result.js';

// ── Public API Types ─────────────────────────────────────────────────────────

export interface ExtractorOptions {
  lenientMode?: boolean;        // default: true
  includeDecorators?: boolean;  // default: true
  maxBarrelDepth?: number;      // default: 10
  excludePatterns?: string[];   // additional globs beyond defaults
}

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

export interface ResolvedImport {
  readonly originalSpecifier: string;
  readonly resolvedFilePath: string;   // absolute path after barrel traversal
  readonly isBarrel: boolean;
  readonly barrelDepth: number;
  readonly importedNames: string[];
  readonly isTypeOnly: boolean;
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

export const DEFAULT_OPTIONS: Required<ExtractorOptions> = {
  lenientMode: true,
  includeDecorators: true,
  maxBarrelDepth: 10,
  excludePatterns: [],
};
