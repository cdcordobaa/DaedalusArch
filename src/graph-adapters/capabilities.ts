import { CYPHER_TEMPLATES } from '../fitness-compiler/cypher-templates.js';
import { EDGE_TYPES, NODE_TYPES } from '../shared/types/enums.js';
import type { EdgeType, NodeType } from '../shared/types/enums.js';
import { EXTERNAL_FORMATS } from './types.js';
import type { ExternalFormat, FormatCapabilities, Provenance } from './types.js';

type Edges = Readonly<Record<EdgeType, Provenance>>;
type Nodes = Readonly<Record<NodeType, Provenance>>;

const NO_FLOW: Pick<Record<EdgeType, Provenance>, 'CONSTRUCTOR_INJECTS' | 'RE_EXPORTS' | 'FLOWS_TO'> = {
  CONSTRUCTOR_INJECTS: 'absent', RE_EXPORTS: 'absent', FLOWS_TO: 'absent',
};

const GRAPHIFY_EDGES: Edges = {
  IMPORTS: 'derived', CONTAINS: 'derived', DECLARES: 'derived',
  // graphify has one `inherits` relation and no interface kind: `implements` surfaces as class→class inheritance.
  EXTENDS: 'heuristic', IMPLEMENTS: 'absent', CALLS: 'derived', ...NO_FLOW,
};
const GRAPHIFY_NODES: Nodes = {
  File: 'derived', Class: 'derived', Interface: 'absent', Method: 'derived', Function: 'derived', Package: 'derived',
};
const GRAPHIFY_NOTES: readonly string[] = [
  'No interface node kind: TypeScript interfaces arrive as classes, so abstraction-ratio is 0 and `implements` becomes EXTENDS.',
  'Import edges carry no line, no type-only flag and no imported names.',
  'Edges are scored EXTRACTED / INFERRED / AMBIGUOUS; `minConfidence` filters them.',
];

/**
 * What each external format can yield, per APG node and edge type. `native` = the tool has the construct;
 * `derived` = the adapter lifts, resolves or renames it; `heuristic` = a guess that can be wrong;
 * `absent` = no data. Derived from the public docs and sources read for v1.3 (Docs/v1.3-graph-adapter-notes.md §1).
 */
export const FORMAT_CAPABILITIES: Readonly<Record<ExternalFormat, FormatCapabilities>> = {
  'graphify-json': { format: 'graphify-json', edges: GRAPHIFY_EDGES, nodes: GRAPHIFY_NODES, notes: GRAPHIFY_NOTES },
  'graphify-graphml': {
    format: 'graphify-graphml', edges: GRAPHIFY_EDGES, nodes: GRAPHIFY_NODES,
    notes: [...GRAPHIFY_NOTES, 'GraphML flattens every attribute to a string; `community` is -1 for an unclustered node.'],
  },
  codegraphcontext: {
    format: 'codegraphcontext',
    edges: { IMPORTS: 'derived', CONTAINS: 'native', DECLARES: 'native', EXTENDS: 'derived', IMPLEMENTS: 'heuristic', CALLS: 'native', ...NO_FLOW },
    nodes: { File: 'native', Class: 'native', Interface: 'heuristic', Method: 'derived', Function: 'native', Package: 'derived' },
    notes: [
      'IMPORTS targets are Module nodes named by specifier; the adapter resolves relative specifiers and drops alias (`paths`) imports it cannot resolve.',
      'One INHERITS type: class→interface is read as IMPLEMENTS; an Interface label is unverified for TypeScript.',
      'Node paths are absolute; the adapter relativises them (`projectRoot` or the common directory prefix).',
    ],
  },
  gitnexus: {
    format: 'gitnexus',
    edges: { IMPORTS: 'native', CONTAINS: 'derived', DECLARES: 'native', EXTENDS: 'native', IMPLEMENTS: 'native', CALLS: 'native', ...NO_FLOW },
    nodes: { File: 'native', Class: 'native', Interface: 'native', Method: 'native', Function: 'native', Package: 'absent' },
    notes: [
      'External imports are not documented as nodes, so Package nodes are treated as absent. No documented file export; the reader takes the graph\'s in-memory shape (an assumption to confirm).',
      'Edges carry `confidence` and `reason`; calls resolved by global fuzzy match score 0.3-0.5.',
    ],
  },
};

/** Per-format property support beyond node and edge types. */
export const FORMAT_PROPERTIES: Readonly<Record<ExternalFormat, { readonly decorators: Provenance; readonly isBarrel: Provenance }>> = {
  'graphify-json': { decorators: 'absent', isBarrel: 'heuristic' },
  'graphify-graphml': { decorators: 'absent', isBarrel: 'heuristic' },
  codegraphcontext: { decorators: 'derived', isBarrel: 'heuristic' },
  gitnexus: { decorators: 'absent', isBarrel: 'heuristic' },
};

// ── Template requirements, read off the compiled Cypher ───────────────────────────────────────────────────

export type EdgeUse = 'required' | 'optional' | 'negated';

export interface TemplateRequirements {
  readonly functionName: string;
  readonly edgeGroups: readonly { readonly types: readonly EdgeType[]; readonly use: EdgeUse }[];
  /** Labels in a `(x:Label)` pattern (the match needs them) and labels only used as `x:Label` filters. */
  readonly structuralLabels: readonly NodeType[];
  readonly filterLabels: readonly NodeType[];
  readonly usesBarrel: boolean;
  readonly usesDecorators: boolean;
}

const EDGE_SET: ReadonlySet<string> = new Set(EDGE_TYPES);
const NODE_SET: ReadonlySet<string> = new Set(NODE_TYPES);

export function requirementsOf(functionName: string, cypher: string): TemplateRequirements {
  const edgeGroups: { types: EdgeType[]; use: EdgeUse }[] = [];
  const structural = new Set<NodeType>();
  const filter = new Set<NodeType>();
  for (const line of cypher.split('\n')) {
    const use: EdgeUse = line.includes('NOT EXISTS') ? 'negated' : line.includes('OPTIONAL MATCH') ? 'optional' : 'required';
    for (const m of line.matchAll(/\[\s*\w*\s*:\s*([A-Z_]+(?:\|[A-Z_]+)*)(?:\*[\d.]*)?\s*\]/g)) {
      const types = (m[1] ?? '').split('|').filter((t): t is EdgeType => EDGE_SET.has(t));
      if (types.length > 0) edgeGroups.push({ types, use });
    }
    for (const m of line.matchAll(/\(\s*\w*\s*:\s*(\w+)\s*\)/g)) {
      if (NODE_SET.has(m[1] ?? '')) structural.add(m[1] as NodeType);
    }
    for (const m of line.matchAll(/\b\w+:(\w+)\b/g)) {
      const l = m[1] ?? '';
      if (NODE_SET.has(l) && !structural.has(l as NodeType)) filter.add(l as NodeType);
    }
  }
  for (const l of structural) filter.delete(l);
  return {
    functionName, edgeGroups, structuralLabels: [...structural], filterLabels: [...filter],
    usesBarrel: cypher.includes('isBarrel'), usesDecorators: cypher.includes('.decorators'),
  };
}

export type CoverageStatus = 'full' | 'partial' | 'degraded' | 'blocked';
const ORDER: readonly CoverageStatus[] = ['full', 'partial', 'degraded', 'blocked'];

export interface CoverageCell {
  readonly status: CoverageStatus;
  readonly reasons: readonly string[];
}

/** Whether the template runs on a graph with these capabilities, and how far its result can be trusted. */
export function coverageOf(req: TemplateRequirements, caps: FormatCapabilities): CoverageCell {
  let worst: CoverageStatus = 'full';
  const reasons: string[] = [];
  const note = (s: CoverageStatus, why: string): void => {
    if (ORDER.indexOf(s) > ORDER.indexOf(worst)) worst = s;
    if (!reasons.includes(why)) reasons.push(why);
  };
  for (const g of req.edgeGroups) {
    const label = g.types.join('|');
    const usable = g.types.filter((t) => caps.edges[t] !== 'absent');
    if (usable.length === 0) {
      if (g.use === 'required') note('blocked', `${label} never produced: the pattern matches nothing, so the rule passes vacuously`);
      else if (g.use === 'negated') note('blocked', `${label} never produced: every candidate is flagged (false positives)`);
      else note('partial', `${label} never produced: the optional arm is always empty`);
    } else if (usable.length < g.types.length) {
      const lost = g.types.filter((t) => caps.edges[t] === 'absent').join(', ');
      note('partial', `${lost} never produced (${label}): those hops are invisible`);
    }
    if (usable.length > 0 && usable.every((t) => caps.edges[t] === 'heuristic')) note('degraded', `${usable.join('|')} is a heuristic edge`);
  }
  for (const l of req.structuralLabels) {
    if (caps.nodes[l] === 'absent') note('blocked', `no ${l} nodes`);
    else if (caps.nodes[l] === 'heuristic') note('degraded', `${l} nodes are a guess`);
  }
  for (const l of req.filterLabels) {
    if (caps.nodes[l] === 'absent') note('degraded', `no ${l} nodes`);
  }
  if (req.functionName === 'abstraction-ratio' && caps.nodes.Interface === 'absent') {
    note('blocked', 'no Interface nodes: the ratio is 0 and the rule always flags');
  }
  const props = FORMAT_PROPERTIES[caps.format];
  if (req.usesBarrel && props.isBarrel !== 'native') note('partial', 'isBarrel is a filename heuristic');
  if (req.usesDecorators && props.decorators === 'absent') note('blocked', 'no decorators: the pattern matches nothing');
  return { status: worst, reasons };
}

export type CoverageMatrix = Readonly<Record<string, Readonly<Record<ExternalFormat, CoverageCell>>>>;

/** The coverage of every compiled template on every external format, in template order. */
export function computeCoverageMatrix(): CoverageMatrix {
  const out: Record<string, Record<ExternalFormat, CoverageCell>> = {};
  for (const [name, t] of CYPHER_TEMPLATES) {
    const req = requirementsOf(name, t.template);
    const row = {} as Record<ExternalFormat, CoverageCell>;
    for (const f of EXTERNAL_FORMATS) row[f] = coverageOf(req, FORMAT_CAPABILITIES[f]);
    out[name] = row;
  }
  return out;
}
