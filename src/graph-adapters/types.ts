import type { APGEdge, APGNode } from '../shared/types/apg.js';
import type { EdgeType, NodeType } from '../shared/types/enums.js';

/** The external export formats the v1.3 prototype adapters read. */
export const EXTERNAL_FORMATS = ['graphify-json', 'graphify-graphml', 'codegraphcontext', 'gitnexus'] as const;
export type ExternalFormat = (typeof EXTERNAL_FORMATS)[number];

/** Node kind after a format reader has interpreted its tool's own labels. */
export type NormKind = 'file' | 'class' | 'interface' | 'method' | 'function' | 'package' | 'other';

/**
 * Relation after a format reader has interpreted its tool's own edge types. `contains` covers every
 * parent-to-child edge (the builder picks DECLARES or CONTAINS from the endpoint kinds); `inherits` is the
 * tools' undifferentiated inheritance edge (the builder picks EXTENDS or IMPLEMENTS from the endpoint kinds).
 */
export type NormRel = 'imports' | 'contains' | 'extends' | 'implements' | 'inherits' | 'calls' | 'unmapped';

export interface NormNode {
  readonly id: string;
  readonly kind: NormKind;
  readonly name: string;
  /** Project-relative path of the declaring file (the file's own path for a file node). */
  readonly filePath?: string;
  /** External id of the declaring class or interface, for a method. */
  readonly ownerId?: string;
  readonly decorators?: readonly string[];
}

export interface NormEdge {
  readonly source: string;
  /** External id of the target node. */
  readonly target?: string;
  /** Module specifier of an import whose target is not a node of the export (CodeGraphContext Module names). */
  readonly targetSpecifier?: string;
  readonly rel: NormRel;
  readonly line?: number;
  /** 0..1, when the tool scores its edges. */
  readonly confidence?: number;
  /** The tool's own relation or type string, kept for the unmapped-relation accounting. */
  readonly originalType: string;
}

export interface NormalizedGraph {
  readonly nodes: readonly NormNode[];
  readonly edges: readonly NormEdge[];
}

export interface AdapterOptions {
  /** Drop edges whose confidence is below this value (default 0: keep every edge). */
  readonly minConfidence?: number;
}

/** How a format yields an APG edge type: from a native edge, by lifting or resolving, or by a guess. */
export type Provenance = 'native' | 'derived' | 'heuristic' | 'absent';

export interface FormatCapabilities {
  readonly format: ExternalFormat;
  readonly edges: Readonly<Record<EdgeType, Provenance>>;
  readonly nodes: Readonly<Record<NodeType, Provenance>>;
  /** Plain-language limits that the matrix cannot express as a provenance. */
  readonly notes: readonly string[];
}

export interface AdapterReport {
  readonly format: ExternalFormat;
  readonly nodeCountByType: Readonly<Partial<Record<NodeType, number>>>;
  readonly edgeCountByType: Readonly<Partial<Record<EdgeType, number>>>;
  /** APG edge types this export produced no edge of (including those the format can never produce). */
  readonly missingEdgeTypes: readonly EdgeType[];
  /** APG edge types the format cannot produce at all. */
  readonly unavailableEdgeTypes: readonly EdgeType[];
  /** Tool edges that did not become an APG edge, by reason. */
  readonly dropped: Readonly<Record<string, number>>;
  /** Tool relation strings with no APG counterpart, with their counts. */
  readonly unmappedRelations: Readonly<Record<string, number>>;
  readonly warnings: readonly string[];
}

export interface AdapterResult {
  readonly nodes: readonly APGNode[];
  readonly edges: readonly APGEdge[];
  readonly report: AdapterReport;
}
