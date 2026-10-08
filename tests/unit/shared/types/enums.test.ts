import {
  NODE_TYPES,
  EDGE_TYPES,
  DIMENSIONS,
  SYMBOLIC_DIMENSIONS,
  MODEL_JUDGED_DIMENSIONS,
  LAYER_KINDS,
} from '../../../../src/shared/types/enums.js';
import type {
  NodeType,
  EdgeType,
  Dimension,
  LayerKind,
  TemplateTag,
  JudgeUnitKind,
} from '../../../../src/shared/types/enums.js';
import * as shared from '../../../../src/shared/index.js';
import {
  NODE_INGESTION_ORDER,
  EDGE_INGESTION_ORDER,
} from '../../../../src/neo4j-ingestion/graph-ingester.js';

describe('C10 enumerations', () => {
  it('NODE_TYPES holds the five existing node types plus Package', () => {
    expect([...NODE_TYPES]).toEqual(['File', 'Class', 'Interface', 'Method', 'Function', 'Package']);
  });

  it('EDGE_TYPES holds the seven existing edge types plus FLOWS_TO and RE_EXPORTS', () => {
    expect([...EDGE_TYPES]).toEqual([
      'IMPORTS', 'IMPLEMENTS', 'EXTENDS', 'CONSTRUCTOR_INJECTS', 'CALLS', 'DECLARES', 'CONTAINS',
      'FLOWS_TO', 'RE_EXPORTS',
    ]);
  });

  it('DIMENSIONS has seven members: integrity in, intent removed (U3-R7, BR-U3-30)', () => {
    expect([...DIMENSIONS]).toEqual([
      'structural', 'coupling', 'pattern', 'solid', 'convention', 'semantic', 'integrity',
    ]);
  });

  it('SYMBOLIC_DIMENSIONS and MODEL_JUDGED_DIMENSIONS are subsets of DIMENSIONS and disjoint', () => {
    expect([...SYMBOLIC_DIMENSIONS]).toEqual(['structural', 'coupling', 'pattern', 'solid', 'convention']);
    expect([...MODEL_JUDGED_DIMENSIONS]).toEqual(['semantic', 'integrity']);
    const all: readonly string[] = DIMENSIONS;
    for (const d of [...SYMBOLIC_DIMENSIONS, ...MODEL_JUDGED_DIMENSIONS]) expect(all).toContain(d);
    const symbolic: readonly string[] = SYMBOLIC_DIMENSIONS;
    for (const d of MODEL_JUDGED_DIMENSIONS) expect(symbolic).not.toContain(d);
  });

  it('LAYER_KINDS holds the four layer roles', () => {
    expect([...LAYER_KINDS]).toEqual(['domain', 'application', 'infrastructure', 'presentation']);
  });

  it('derived unions accept the array members (compile-time check via tsconfig.u0-tests.json)', () => {
    const n: NodeType = 'Package';
    const e: EdgeType[] = ['FLOWS_TO', 'RE_EXPORTS'];
    const d: Dimension[] = ['integrity', 'semantic'];
    const k: LayerKind = 'application';
    const t: TemplateTag[] = ['structural', 'topological', 'pattern-proxy'];
    const j: JudgeUnitKind[] = ['file', 'class', 'module'];
    expect(NODE_TYPES).toContain(n);
    for (const x of e) expect(EDGE_TYPES).toContain(x);
    for (const x of d) expect(DIMENSIONS).toContain(x);
    expect(LAYER_KINDS).toContain(k);
    expect(t).toHaveLength(3);
    expect(j).toHaveLength(3);
  });

  it('the shared barrel exports the arrays as values', () => {
    expect(shared.NODE_TYPES).toBe(NODE_TYPES);
    expect(shared.EDGE_TYPES).toBe(EDGE_TYPES);
    expect(shared.DIMENSIONS).toBe(DIMENSIONS);
    expect(shared.SYMBOLIC_DIMENSIONS).toBe(SYMBOLIC_DIMENSIONS);
    expect(shared.MODEL_JUDGED_DIMENSIONS).toBe(MODEL_JUDGED_DIMENSIONS);
    expect(shared.LAYER_KINDS).toBe(LAYER_KINDS);
  });
});

describe('graph ingester order (D-U0-13)', () => {
  it('ingests nodes in the pre-enum order, Package last', () => {
    expect([...NODE_INGESTION_ORDER]).toEqual(['File', 'Class', 'Interface', 'Method', 'Function', 'Package']);
  });

  it('ingests the seven pre-enum edge types first, in their old order, then the new ones', () => {
    expect(EDGE_INGESTION_ORDER.slice(0, 7)).toEqual([
      'IMPORTS', 'DECLARES', 'CONTAINS', 'EXTENDS', 'IMPLEMENTS', 'CONSTRUCTOR_INJECTS', 'CALLS',
    ]);
    expect(EDGE_INGESTION_ORDER.slice(7)).toEqual(['FLOWS_TO', 'RE_EXPORTS']);
  });

  it('covers every enum member exactly once', () => {
    expect([...NODE_INGESTION_ORDER].sort()).toEqual([...NODE_TYPES].sort());
    expect([...EDGE_INGESTION_ORDER].sort()).toEqual([...EDGE_TYPES].sort());
  });
});
