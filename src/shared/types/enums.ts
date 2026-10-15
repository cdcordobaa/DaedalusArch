// Single source of truth for the C10 enumerations; the union types are derived from these arrays
// (FR-09, FR-21, FR-22, FR-32, FR-34).
export const NODE_TYPES = ['File', 'Class', 'Interface', 'Method', 'Function', 'Package'] as const;

export const EDGE_TYPES = [
  'IMPORTS',
  'IMPLEMENTS',
  'EXTENDS',
  'CONSTRUCTOR_INJECTS',
  'CALLS',
  'DECLARES',
  'CONTAINS',
  'FLOWS_TO',
  'RE_EXPORTS',
] as const;

// v1.3 NestJS module-wiring edge types (`moduleWiring` extractor option, ON by default in v1.3). Kept apart from
// EDGE_TYPES, which the frozen v1.2E report schema, the SO2 CSV columns and the registered artefacts mirror.
export const V13_EDGE_TYPES = ['MODULE_IMPORTS', 'MODULE_PROVIDES', 'MODULE_EXPORTS'] as const;

// APG v2 (`apg2` extractor option, OFF in both the v1.2E and the v1.3 defaults; `Docs/v1.3/apg2-design.md`). Kept
// apart from NODE_TYPES / EDGE_TYPES for the same reason as V13_EDGE_TYPES: the frozen enumerations are mirrored by
// the v1.2E report schema and registered artefacts.
export const APG2_NODE_TYPES = ['Component', 'Channel', 'IOCategory'] as const;
export const APG2_EDGE_TYPES = [
  'SIGNATURE_USES',
  'BELONGS_TO',
  'DEPENDS_ON',
  'EXPORTS_SYMBOL',
  'DEEP_IMPORT',
  'PUBLISHES',
  'SUBSCRIBES',
  'PERFORMS_IO',
] as const;

// Seven dimensions (FR-32; U3-R7, BR-U3-30): intent is no longer a member. It survives only as a
// deprecated YAML alias normalised by the spec parser (BR-U1-20/21); INTENT_VIOLATION stays (U4 Q11 A).
export const DIMENSIONS = [
  'structural',
  'coupling',
  'pattern',
  'solid',
  'convention',
  'semantic',
  'integrity',
] as const;

export const SYMBOLIC_DIMENSIONS = ['structural', 'coupling', 'pattern', 'solid', 'convention'] as const;

export const MODEL_JUDGED_DIMENSIONS = ['semantic', 'integrity'] as const;

export const LAYER_KINDS = ['domain', 'application', 'infrastructure', 'presentation'] as const;

export type NodeType = (typeof NODE_TYPES)[number];

export type EdgeType = (typeof EDGE_TYPES)[number];

export type V13EdgeType = (typeof V13_EDGE_TYPES)[number];

export type Apg2NodeType = (typeof APG2_NODE_TYPES)[number];

export type Apg2EdgeType = (typeof APG2_EDGE_TYPES)[number];

export type Dimension = (typeof DIMENSIONS)[number];

// Layer role used for parameter binding (FR-19)
export type LayerKind = (typeof LAYER_KINDS)[number];

// Catalogue tag of each template (FR-29)
export type TemplateTag = 'structural' | 'topological' | 'pattern-proxy';

// Judge unit granularity (FR-33)
export type JudgeUnitKind = 'file' | 'class' | 'module';

export type Severity = 'critical' | 'major' | 'minor' | 'advisory';

export type Route = 'symbolic' | 'neuronal' | 'hybrid';

export type EvaluationMode = 'full' | 'symbolic-only' | 'neuronal-only';

export type PipelineMode = 'stateless' | 'persistent';

export type OverallVerdict = 'pass' | 'warning' | 'soft-block' | 'hard-block';

export type ADRFormat = 'MADR' | 'Nygard' | 'Y-Statement' | 'custom-yaml';
