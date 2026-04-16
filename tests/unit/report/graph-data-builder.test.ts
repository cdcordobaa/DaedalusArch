import { buildGraphData } from '../../../src/report/graph-data-builder.js';
import { functionId } from '../../../src/shared/types/value-objects.js';
import type { APGResult, APGNode, APGEdge } from '../../../src/shared/types/apg.js';
import type { ParsedSpec, LayerModel } from '../../../src/shared/types/spec.js';
import type { ActionableViolation } from '../../../src/shared/taxonomy/violation-types.js';

function makeNode(overrides: Partial<APGNode> = {}): APGNode {
  return {
    id: 'node-1',
    type: 'File',
    filePath: 'src/domain/User.ts',
    name: 'User.ts',
    layer: 'domain',
    decorators: [],
    properties: {},
    ...overrides,
  };
}

function makeEdge(overrides: Partial<APGEdge> = {}): APGEdge {
  return {
    id: 'edge-1',
    type: 'IMPORTS',
    sourceId: 'node-1',
    targetId: 'node-2',
    properties: {},
    ...overrides,
  };
}

function makeAPGResult(nodes: APGNode[], edges: APGEdge[]): APGResult {
  return {
    nodes,
    edges,
    parseCoverage: { total: nodes.length, parsed: nodes.length, percentage: 100, skipped: [] },
    warnings: [],
  };
}

function makeSpec(layers: string[]): ParsedSpec {
  const layerModel: LayerModel = {
    layers: layers.map((name) => ({
      name,
      directories: [`src/${name}/`],
      naming: [],
      role: name,
    })),
  };
  return {
    specVersion: '1.0',
    layerModel,
    fitnessFunctions: [],
    scoringWeights: { structural: 0.35, coupling: 0.2, pattern: 0.3, solid: 0.1, convention: 0.05, semantic: 0, intent: 0 },
    verdictThresholds: { pass: 0.8, warning: 0.65, softBlock: 0.5 },
    confidenceThresholds: { high: 0.85, medium: 0.6, iccMinimum: 0.7 },
    adrRules: [],
  };
}

function makeActionableViolation(overrides: Partial<ActionableViolation> = {}): ActionableViolation {
  return {
    id: 'v-1',
    type: 'LAYER_VIOLATION',
    dimension: 'structural',
    severity: 'major',
    functionId: functionId('FF-S01'),
    route: 'symbolic',
    filePath: 'src/domain/User.ts',
    message: 'violation',
    deterministic: true,
    what: '[major] FF-S01',
    where: 'src/domain/User.ts',
    why: 'layer violation',
    fix: 'fix it',
    baselineStatus: 'none',
    ...overrides,
  };
}

describe('buildGraphData', () => {
  it('creates nodes from File-type APG nodes', () => {
    const nodes = [
      makeNode({ id: 'n1', name: 'User.ts', layer: 'domain', filePath: 'src/domain/User.ts' }),
      makeNode({ id: 'n2', name: 'UserRepo.ts', layer: 'infrastructure', filePath: 'src/infra/UserRepo.ts' }),
    ];
    const apg = makeAPGResult(nodes, []);
    const spec = makeSpec(['domain', 'infrastructure']);

    const result = buildGraphData(apg, spec, []);

    expect(result.nodes).toHaveLength(2);
    expect(result.nodes[0]!.data.id).toBe('n1');
    expect(result.nodes[0]!.data.label).toBe('User.ts');
    expect(result.nodes[0]!.data.layer).toBe('domain');
    expect(result.nodes[1]!.data.layer).toBe('infrastructure');
  });

  it('filters out non-File nodes', () => {
    const nodes = [
      makeNode({ id: 'n1', type: 'File' }),
      makeNode({ id: 'n2', type: 'Class', name: 'UserClass' }),
    ];
    const apg = makeAPGResult(nodes, []);
    const result = buildGraphData(apg, makeSpec(['domain']), []);
    expect(result.nodes).toHaveLength(1);
  });

  it('creates edges from IMPORTS relationships between File nodes', () => {
    const nodes = [
      makeNode({ id: 'n1', filePath: 'a.ts' }),
      makeNode({ id: 'n2', filePath: 'b.ts' }),
    ];
    const edges = [makeEdge({ id: 'e1', sourceId: 'n1', targetId: 'n2', type: 'IMPORTS' })];
    const apg = makeAPGResult(nodes, edges);

    const result = buildGraphData(apg, makeSpec(['domain']), []);

    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]!.data.source).toBe('n1');
    expect(result.edges[0]!.data.target).toBe('n2');
    expect(result.edges[0]!.data.isViolation).toBe(false);
  });

  it('filters out non-IMPORTS edges', () => {
    const nodes = [makeNode({ id: 'n1' }), makeNode({ id: 'n2' })];
    const edges = [makeEdge({ id: 'e1', type: 'EXTENDS' })];
    const apg = makeAPGResult(nodes, edges);

    const result = buildGraphData(apg, makeSpec(['domain']), []);
    expect(result.edges).toHaveLength(0);
  });

  it('assigns violation counts to nodes', () => {
    const nodes = [makeNode({ id: 'n1', filePath: 'src/domain/User.ts' })];
    const apg = makeAPGResult(nodes, []);
    const violations = [
      makeActionableViolation({ filePath: 'src/domain/User.ts' }),
      makeActionableViolation({ id: 'v2', filePath: 'src/domain/User.ts' }),
    ];

    const result = buildGraphData(apg, makeSpec(['domain']), violations);
    expect(result.nodes[0]!.data.violationCount).toBe(2);
  });

  it('provides layer colors from spec', () => {
    const spec = makeSpec(['domain', 'infrastructure']);
    const result = buildGraphData(makeAPGResult([], []), spec, []);

    expect(result.layerColors).toHaveProperty('domain');
    expect(result.layerColors).toHaveProperty('infrastructure');
  });

  it('handles empty graph gracefully', () => {
    const result = buildGraphData(makeAPGResult([], []), makeSpec([]), []);
    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
  });
});
