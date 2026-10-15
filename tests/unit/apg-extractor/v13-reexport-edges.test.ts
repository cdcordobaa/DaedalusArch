/**
 * ADR-V13-01: literal + resolved IMPORTS edges for re-exports (barrels), `reExportEdges` option.
 * Fixture: `fixtures/unit/v13-barrels` (single-hop, multi-hop, `export *`, type-only, aliased, mixed, cycles, and the
 * order-fulfilment shape infrastructure -> application barrel -> domain).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { DEFAULT_OPTIONS, V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS } from '../../../src/apg-extractor/types.js';
import type { APGEdge, APGResult } from '../../../src/shared/types/apg.js';
import { harnessTsconfigText } from '../../../scripts/lib/generators/harness-tsconfig.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const FIXTURE = path.join(REPO_ROOT, 'fixtures/unit/v13-barrels');
const GOLDEN_FIXTURES = ['correct-reference', 'variant-a-structural', 'variant-b-pattern', 'variant-c-everything', 'variant-d-subtle']
  .map((id) => path.join(REPO_ROOT, 'fixtures', id));

interface Edge {
  readonly from: string;
  readonly to: string;
  readonly names: readonly string[];
  readonly typeOnly: boolean;
  readonly via: boolean;
  readonly barrels: readonly string[] | undefined;
  readonly hop: boolean;
}

function nameOf(apg: APGResult): Map<string, string> {
  return new Map(apg.nodes.map((n) => [n.id, n.type === 'File' ? n.filePath : `pkg:${String(n.name)}`]));
}

function importEdges(apg: APGResult): Edge[] {
  const name = nameOf(apg);
  return apg.edges.filter((e) => e.type === 'IMPORTS').map((e) => {
    const p = e.properties as Record<string, unknown>;
    return {
      from: name.get(e.sourceId) ?? e.sourceId,
      to: name.get(e.targetId) ?? e.targetId,
      names: p.importedNames as string[],
      typeOnly: p.isTypeOnly === true,
      via: p.viaReExport === true,
      barrels: p.reExportBarrels as string[] | undefined,
      hop: p.reExportHop === true,
    };
  });
}

function from(edges: readonly Edge[], file: string): Edge[] {
  return edges.filter((e) => e.from === `src/infrastructure/${file}`);
}

/** The resolved view (ADR-V13-01): drop `reExportHop` IMPORTS edges and the two v1.3 properties. */
function resolvedView(apg: APGResult): APGEdge[] {
  return apg.edges
    .filter((e) => !(e.type === 'IMPORTS' && e.properties.reExportHop === true))
    .map((e) => {
      const { viaReExport: _v, reExportBarrels: _b, ...rest } = e.properties as Record<string, unknown>;
      return { ...e, properties: rest };
    });
}

async function extract(project: string, options: object, tsconfig?: string): Promise<APGResult> {
  const r = await extractAPG(project, options, tsconfig);
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  return r.data;
}

let v13: APGResult;
let v12e: APGResult;
let v13Edges: Edge[];
let v12eEdges: Edge[];

beforeAll(async () => {
  v13 = await extract(FIXTURE, {});
  v12e = await extract(FIXTURE, V12E_DEFAULT_OPTIONS);
  v13Edges = importEdges(v13);
  v12eEdges = importEdges(v12e);
}, 60_000);

describe('reExportEdges option (ADR-V13-01)', () => {
  it("is 'both' in the v1.3 defaults and 'resolved-only' in the frozen v1.2E defaults", () => {
    expect(DEFAULT_OPTIONS).toBe(V13_DEFAULT_OPTIONS);
    expect(V13_DEFAULT_OPTIONS.reExportEdges).toBe('both');
    expect(V12E_DEFAULT_OPTIONS.reExportEdges).toBe('resolved-only');
  });

  it("explicit 'both' equals the v1.3 default", async () => {
    const explicit = await extract(FIXTURE, { reExportEdges: 'both' });
    expect(explicit.edges).toEqual(v13.edges);
  });

  it('v1.2E mode carries neither property on any edge', () => {
    for (const e of v12e.edges) {
      expect(e.properties).not.toHaveProperty('viaReExport');
      expect(e.properties).not.toHaveProperty('reExportBarrels');
      expect(e.properties).not.toHaveProperty('reExportHop');
    }
  });
});

describe('order-fulfilment case: infrastructure -> application barrel -> domain', () => {
  const FILE = 'persistence/InMemoryOrderRepository.ts';
  const BARREL = 'src/application/ports/persistence.ts';

  it('v1.3: the literal infrastructure -> application edge AND the infrastructure -> domain edges via the barrel', () => {
    const edges = from(v13Edges, FILE);
    const literal = edges.filter((e) => !e.via);
    expect(literal).toEqual([{
      from: `src/infrastructure/${FILE}`, to: BARREL, names: ['Order', 'OrderRepository', 'OrderSnapshot', 'OrderStatus'],
      typeOnly: false, via: false, barrels: undefined, hop: true,
    }]);
    const resolved = edges.filter((e) => e.via).map((e) => ({ to: e.to, names: e.names, typeOnly: e.typeOnly, barrels: e.barrels }));
    expect(resolved).toEqual([
      { to: 'src/domain/entities/Order.ts', names: ['Order', 'OrderSnapshot'], typeOnly: false, barrels: [BARREL] },
      { to: 'src/domain/repositories/OrderRepository.ts', names: ['OrderRepository'], typeOnly: true, barrels: [BARREL] },
      { to: 'src/domain/value-objects/OrderStatus.ts', names: ['OrderStatus'], typeOnly: true, barrels: [BARREL] },
    ]);
  });

  it('v1.2E: only the resolved infrastructure -> domain edges, no edge to the barrel', () => {
    const edges = from(v12eEdges, FILE);
    expect(edges.map((e) => e.to)).toEqual([
      'src/domain/entities/Order.ts', 'src/domain/repositories/OrderRepository.ts', 'src/domain/value-objects/OrderStatus.ts',
    ]);
    expect(edges.every((e) => !e.via && !e.hop && e.barrels === undefined)).toBe(true);
  });
});

describe('barrel shapes', () => {
  const resolvedOf = (file: string): Edge[] => from(v13Edges, file).filter((e) => e.via);
  const literalOf = (file: string): Edge[] => from(v13Edges, file).filter((e) => !e.via);

  it.each([
    ['star.ts', 'src/domain/index.ts', 'src/domain/value-objects/Money.ts', ['src/domain/index.ts']],
    ['multiHop.ts', 'src/application/facade.ts', 'src/domain/entities/Order.ts', ['src/application/facade.ts', 'src/application/ports/persistence.ts']],
    ['multiStar.ts', 'src/application/index.ts', 'src/domain/value-objects/Money.ts', ['src/application/index.ts', 'src/application/ports/persistence.ts']],
    ['aliased.ts', 'src/application/ports/persistence.ts', 'src/domain/value-objects/Money.ts', ['src/application/ports/persistence.ts']],
    ['typeOnly.ts', 'src/application/ports/persistence.ts', 'src/domain/value-objects/OrderStatus.ts', ['src/application/ports/persistence.ts']],
  ])('%s: literal edge to %s (reExportHop), resolved edge to %s via %j', (file, barrel, declaring, barrels) => {
    expect(literalOf(file).map((e) => [e.to, e.hop])).toEqual([[barrel, true]]);
    expect(resolvedOf(file).map((e) => [e.to, e.barrels])).toEqual([[declaring, barrels]]);
    // v1.2E: the resolved edge only, to the same declaring file.
    expect(from(v12eEdges, file).map((e) => e.to)).toEqual([declaring]);
  });

  it('aliased re-export keeps the imported (exported) name on both edges', () => {
    expect(from(v13Edges, 'aliased.ts').map((e) => e.names)).toEqual([['Amount'], ['Amount']]);
  });

  it('type-only re-export: both edges are type-only', () => {
    expect(from(v13Edges, 'typeOnly.ts').map((e) => e.typeOnly)).toEqual([true, true]);
  });

  it('a barrel that declares one of the names: the literal edge is not a hop', () => {
    expect(literalOf('mixed.ts')).toEqual([expect.objectContaining({ to: 'src/application/index.ts', names: ['APPLICATION_VERSION', 'Order'], hop: false })]);
    expect(resolvedOf('mixed.ts').map((e) => [e.to, e.names])).toEqual([['src/domain/entities/Order.ts', ['Order']]]);
    expect(from(v12eEdges, 'mixed.ts').map((e) => e.to)).toEqual(['src/application/index.ts', 'src/domain/entities/Order.ts']);
  });

  it('a direct import and a barrel import of the same file: the edge to it is unmarked (it is literal too)', () => {
    const edges = from(v13Edges, 'directAndBarrel.ts');
    expect(edges.map((e) => [e.to, e.via, e.hop])).toEqual([
      ['src/domain/entities/Order.ts', false, false],
      ['src/application/ports/persistence.ts', false, true],
    ]);
  });
});

describe('re-export cycles', () => {
  it('export * cycle (a <-> b): terminates; resolved to the declaring file through the cycle entry', () => {
    expect(from(v13Edges, 'starCycle.ts').map((e) => [e.to, e.via, e.hop, e.barrels])).toEqual([
      ['src/cycle/a.ts', false, true, undefined],
      ['src/cycle/b.ts', true, false, ['src/cycle/a.ts']],
    ]);
  });

  it('named re-export cycle (c <-> d): EXTRACTOR_007 and the literal edge only, in both modes', () => {
    expect(from(v13Edges, 'namedCycle.ts').map((e) => [e.to, e.via, e.hop])).toEqual([['src/cycle/c.ts', false, false]]);
    expect(from(v12eEdges, 'namedCycle.ts').map((e) => e.to)).toEqual(['src/cycle/c.ts']);
    for (const apg of [v13, v12e]) {
      expect(apg.warnings.filter((w) => w.code === 'EXTRACTOR_007').map((w) => w.filePath)).toEqual(['src/infrastructure/namedCycle.ts']);
    }
  });
});

describe('views over the v1.3 graph', () => {
  it('the resolved view of the v1.3 graph has the edges of the v1.2E graph (type, source, target)', async () => {
    const resolvedOnly = await extract(FIXTURE, { ...V13_DEFAULT_OPTIONS, reExportEdges: 'resolved-only' });
    expect(resolvedOnly.edges).toEqual(v12e.edges);
    const ids = (edges: readonly APGEdge[]): string[] => edges.map((e) => e.id).sort();
    expect(ids(resolvedView(v13))).toEqual(ids(v12e.edges));
  });

  it('a resolved-view edge equals its v1.2E edge, except a literal edge that also carries re-exported names', () => {
    const byId = new Map(v12e.edges.map((e) => [e.id, e]));
    const differing = resolvedView(v13).filter((e) => JSON.stringify(e) !== JSON.stringify(byId.get(e.id)));
    // mixed.ts imports APPLICATION_VERSION (declared in the barrel) and Order (re-exported) in one statement: the
    // literal edge to the barrel lists both names; the v1.2E edge lists only the declared one.
    expect(differing.map((e) => [nameOf(v13).get(e.sourceId), e.properties.importedNames])).toEqual([
      ['src/infrastructure/mixed.ts', ['APPLICATION_VERSION', 'Order']],
    ]);
  });

  it('the literal view has every specifier\'s module file as a target and no viaReExport edge', () => {
    const literal = v13Edges.filter((e) => !e.via);
    expect(literal.some((e) => e.to === 'src/application/ports/persistence.ts')).toBe(true);
    // Each importing file of the fixture has exactly one literal edge per import statement target.
    expect(from(literal, 'persistence/InMemoryOrderRepository.ts').map((e) => e.to)).toEqual(['src/application/ports/persistence.ts']);
  });

  it('nodes, warnings, parse coverage and the statement partition are the same in both modes', () => {
    expect(v13.nodes).toEqual(v12e.nodes);
    expect(v13.warnings).toEqual(v12e.warnings);
    expect(v13.parseCoverage).toEqual(v12e.parseCoverage);
    expect(v13.importResolution).toEqual(v12e.importResolution);
  });
});

describe('golden fixtures (FR-30 suite) are unchanged by the option', () => {
  it.each(GOLDEN_FIXTURES.map((f) => [path.basename(f), f]))('%s: v1.3 graph equals the resolved-only graph (no barrel hop in it)', async (_id, dir) => {
    const both = await extract(dir, {});
    const resolvedOnly = await extract(dir, { reExportEdges: 'resolved-only' });
    expect(both).toEqual(resolvedOnly);
  }, 60_000);
});

// The real E1 cell the defect was found on (PR #81, PR #83 E1). Read-only; skipped when the outcomes tree is absent.
const E1_CELL_REL = 'claude-opus-5-5/order-fulfilment/full-aac/run-1';
const E1_CELL = [
  process.env.DAEDALUS_E1_OUTCOMES,
  path.resolve(REPO_ROOT, '../daedalus-e1-outcomes'),
  path.resolve(REPO_ROOT, '../../../../daedalus-e1-outcomes'), // a worktree under DaedalusArch/.claude/worktrees/
].filter((d): d is string => d !== undefined).map((d) => path.join(d, E1_CELL_REL)).find((d) => fs.existsSync(path.join(d, 'src'))) ?? '';
const describeE1 = E1_CELL !== '' ? describe : describe.skip;

describeE1('E1 cell claude-opus-5-5/order-fulfilment/full-aac/run-1 (read-only)', () => {
  it('yields infrastructure -> application (literal) and infrastructure -> domain (viaReExport)', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-barrels-e1-'));
    try {
      const real = fs.realpathSync(E1_CELL);
      const tsconfig = path.join(tmp, 'tsconfig.json');
      fs.writeFileSync(tsconfig, harnessTsconfigText(real));
      const both = importEdges(await extract(real, {}, tsconfig));
      const resolvedOnly = importEdges(await extract(real, V12E_DEFAULT_OPTIONS, tsconfig));
      const src = 'src/infrastructure/persistence/InMemoryOrderRepository.ts';
      const mine = both.filter((e) => e.from === src);
      expect(mine.filter((e) => !e.via).map((e) => [e.to, e.hop])).toEqual([['src/application/ports/persistence.ts', true]]);
      expect(mine.filter((e) => e.via).map((e) => e.to)).toEqual(expect.arrayContaining(['src/domain/entities/Order.ts']));
      expect(mine.filter((e) => e.via).every((e) => e.barrels?.[0] === 'src/application/ports/persistence.ts')).toBe(true);
      expect(resolvedOnly.filter((e) => e.from === src).some((e) => e.to === 'src/application/ports/persistence.ts')).toBe(false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 120_000);
});
