export type NodeType = 'File' | 'Class' | 'Interface' | 'Method' | 'Function';

export type EdgeType =
  | 'IMPORTS'
  | 'IMPLEMENTS'
  | 'EXTENDS'
  | 'CONSTRUCTOR_INJECTS'
  | 'CALLS'
  | 'DECLARES'
  | 'CONTAINS';

export type Dimension =
  | 'structural'
  | 'coupling'
  | 'pattern'
  | 'solid'
  | 'convention'
  | 'semantic'
  | 'intent';

export type Severity = 'critical' | 'major' | 'minor' | 'advisory';

export type Route = 'symbolic' | 'neuronal' | 'hybrid';

export type EvaluationMode = 'full' | 'symbolic-only' | 'neuronal-only';

export type PipelineMode = 'stateless' | 'persistent';

export type OverallVerdict = 'pass' | 'warning' | 'soft-block' | 'hard-block';

export type ADRFormat = 'MADR' | 'Nygard' | 'Y-Statement' | 'custom-yaml';
