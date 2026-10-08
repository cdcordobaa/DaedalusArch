/**
 * U3-R2 (FR-12): row mapping, hashed violation ids and the T-MAP discriminator contract
 * (U3 business-rules.md BR-U3-04, 05, 06, 07, 13, 66; §3 table T-MAP).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import neo4j from 'neo4j-driver';
import { evaluateSymbolic } from '../../../src/evaluation-engine/symbolic-evaluator.js';
import { computeViolationId } from '../../../src/evaluation-engine/index.js';
import { CYPHER_TEMPLATES, TEMPLATE_DISCRIMINATORS } from '../../../src/fitness-compiler/cypher-templates.js';
import { DomainResult } from '../../../src/shared/errors/domain-result.js';
import type { GraphRepository, QueryResult } from '../../../src/shared/interfaces/graph-repository.js';
import type { CypherTemplate } from '../../../src/fitness-compiler/types.js';
import type { Violation } from '../../../src/shared/taxonomy/violation-types.js';
import type { CypherQuery } from '../../../src/shared/types/evaluation.js';
import { functionId } from '../../../src/shared/types/value-objects.js';

const ROOT = path.resolve(__dirname, '../../..');

function must<T>(value: T | undefined, what = 'value'): T {
  if (value === undefined) throw new Error(`${what} missing`);
  return value;
}

function mappingOf(name: string): CypherTemplate['resultMapping'] {
  return must(CYPHER_TEMPLATES.get(name), name).resultMapping;
}

/** A repository that answers every query with the next batch of rows (the last batch repeats). */
function stubRepo(...batches: Record<string, unknown>[][]): GraphRepository {
  let call = 0;
  return {
    executeQuery(): Promise<DomainResult<QueryResult>> {
      const records = batches[Math.min(call, batches.length - 1)] ?? [];
      call += 1;
      return Promise.resolve(DomainResult.ok({ records, summary: { counters: {} } }));
    },
    clearGraph() { return Promise.resolve(DomainResult.ok(undefined)); },
    healthCheck() { return Promise.resolve(true); },
    close() { return Promise.resolve(); },
  };
}

function query(name: string, id = 'FF-T01', source: 'template' | 'adr' = 'template'): CypherQuery {
  return {
    functionId: functionId(id), name, cypher: CYPHER_TEMPLATES.get(name)?.template ?? 'MATCH (n) RETURN n',
    params: {}, dimension: 'structural', severity: 'critical', route: 'symbolic', source,
  };
}

async function violationsOf(q: CypherQuery, repo: GraphRepository): Promise<readonly Violation[]> {
  const out = await evaluateSymbolic({ queries: [q], graphRepository: repo });
  if (!out.success) throw new Error('evaluateSymbolic failed');
  const result = out.data.results[0];
  if (result === undefined) throw new Error('no result');
  return result.violations;
}

const DEP_ROW = {
  source: 'src/domain/a.ts', target: 'src/infra/b.ts', srcLayer: 'domain', tgtLayer: 'infrastructure',
  relType: 'IMPORTS', verb: 'imports', line: 2, lines: [2, 9], isTypeOnly: false,
};

describe('BR-U3-04 row mapping', () => {
  it('maps a dependency-direction row: Neo4j Integer line, lines, target, isTypeOnly, discriminator, tag', async () => {
    const v = must((await violationsOf(query('dependency-direction', 'FF-S01'),
      stubRepo([{ ...DEP_ROW, line: neo4j.int(2), lines: [neo4j.int(2), neo4j.int(9)] }])))[0]);
        expect(v.line).toBe(2);
    expect(typeof v.line).toBe('number');
    expect(v.lines).toEqual([2, 9]);
    expect(v.target).toBe('src/infra/b.ts');
    expect(v.isTypeOnly).toBe(false);
    expect(v.discriminator).toEqual(['IMPORTS']);
    expect(v.tag).toBe('structural');
    expect(v.filePath).toBe('src/domain/a.ts');
    expect(v.message).toBe('src/domain/a.ts (domain) imports from src/infra/b.ts (infrastructure)');
    expect(v).not.toHaveProperty('evidence');
    expect(v.id).toBe(computeViolationId({
      functionId: 'FF-S01', filePath: 'src/domain/a.ts', target: 'src/infra/b.ts', line: 2, discriminator: ['IMPORTS'],
    }));
  });

  it('a null line gives no line key (and a different id than line 2, BR-U3-05 d)', async () => {
    const withLine = must((await violationsOf(query('dependency-direction'), stubRepo([DEP_ROW])))[0]);
    const noLine = must((await violationsOf(query('dependency-direction'), stubRepo([{ ...DEP_ROW, line: null }])))[0]);
    expect(noLine).not.toHaveProperty('line');
    expect(noLine.id).not.toBe(withLine.id);
  });

  it('isTypeOnly is true only for the literal true', async () => {
    const v = must((await violationsOf(query('dependency-direction'), stubRepo([{ ...DEP_ROW, isTypeOnly: true }])))[0]);
    expect(v.isTypeOnly).toBe(true);
  });

  it('maps a cycle row: filePath String(cycle), target cycle[1], line, JSON discriminator, topological tag', async () => {
    const cycle = ['src/a.ts', 'src/b.ts', 'src/a.ts'];
    const v = must((await violationsOf(query('no-cyclic-deps', 'FF-S02'),
      stubRepo([{ cycle, target: 'src/b.ts', line: neo4j.int(4) }])))[0]);
    expect(v.filePath).toBe('src/a.ts,src/b.ts,src/a.ts');
    expect(v.target).toBe('src/b.ts');
    expect(v.line).toBe(4);
    expect(v.discriminator).toEqual([JSON.stringify(cycle)]);
    expect(v.tag).toBe('topological');
    expect(v.message).toBe('Circular dependency: src/a.ts,src/b.ts,src/a.ts');
  });

  it('writes measured values to evidence (max-fan-in, single-responsibility-proxy)', async () => {
    const fan = must((await violationsOf(query('max-fan-in'), stubRepo([{ filePath: 'src/b.ts', name: 'b.ts', fanIn: neo4j.int(7) }])))[0]);
    expect(fan.evidence).toEqual(['fanIn=7']);
    expect(fan.discriminator).toEqual([]);
    const srp = must((await violationsOf(query('single-responsibility-proxy'),
      stubRepo([{ class: 'C', filePath: 'src/c.ts', methodCount: 12, depCount: 3 }])))[0]);
    expect(srp.evidence).toEqual(['methodCount=12', 'depCount=3']);
    expect(srp.discriminator).toEqual(['C']);
    expect(srp.tag).toBe('pattern-proxy');
  });

  it('an ADR query carries no tag', async () => {
    const v = must((await violationsOf(query('adr-custom', 'ADR-003-1', 'adr'), stubRepo([{ filePath: 'src/x.ts' }])))[0]);
    expect(v).not.toHaveProperty('tag');
    expect(v.filePath).toBe('src/x.ts');
  });
});

describe('BR-U3-05 hashed ids', () => {
  const rows = [
    { ...DEP_ROW, source: 'src/domain/a.ts', target: 'src/infra/b.ts' },
    { ...DEP_ROW, source: 'src/domain/a.ts', target: 'src/infra/c.ts', line: 3 },
    { ...DEP_ROW, source: 'src/domain/d.ts', target: 'src/infra/b.ts', relType: 'RE_EXPORTS', verb: 're-exports' },
  ];

  it('the same rows give the same ids in two calls (no module counter)', async () => {
    const first = (await violationsOf(query('dependency-direction'), stubRepo(rows))).map((v) => v.id);
    const second = (await violationsOf(query('dependency-direction'), stubRepo(rows))).map((v) => v.id);
    expect(second).toEqual(first);
    expect(new Set(first).size).toBe(3);
    for (const id of first) expect(id).toMatch(/^v-[0-9a-f]{16}$/);
  });

  it('shuffling the rows leaves the multiset of ids unchanged (FR-12 re-order test)', async () => {
    const ids = (await violationsOf(query('dependency-direction'), stubRepo(rows))).map((v) => v.id).sort();
    const reversed = (await violationsOf(query('dependency-direction'), stubRepo([...rows].reverse()))).map((v) => v.id).sort();
    const rotated = (await violationsOf(query('dependency-direction'), stubRepo([must(rows[1]), must(rows[2]), must(rows[0])]))).map((v) => v.id).sort();
    expect(reversed).toEqual(ids);
    expect(rotated).toEqual(ids);
  });

  it('BR-U3-06 (evaluator): B\'s max-fan-in violation keeps its id when the measured fanIn changes', async () => {
    const repo = stubRepo([{ filePath: 'src/b.ts', name: 'b.ts', fanIn: 5 }], [{ filePath: 'src/b.ts', name: 'b.ts', fanIn: 6 }]);
    const before = await violationsOf(query('max-fan-in', 'FF-C03'), repo);
    const after = await violationsOf(query('max-fan-in', 'FF-C03'), repo);
    expect(must(after[0]).id).toBe(must(before[0]).id);
    expect(must(before[0]).evidence).toEqual(['fanIn=5']);
    expect(must(after[0]).evidence).toEqual(['fanIn=6']);
  });

  it('BR-U3-07 (evaluator): three inheritance-depth rows for one class merge into one violation, depth=6', async () => {
    const vs = await violationsOf(query('inheritance-depth', 'FF-SO03'), stubRepo([
      { class: 'C', filePath: 'src/c.ts', depth: 4 },
      { class: 'C', filePath: 'src/c.ts', depth: 5 },
      { class: 'C', filePath: 'src/c.ts', depth: 6 },
    ]));
    expect(vs).toHaveLength(1);
    expect(must(vs[0]).evidence).toEqual(['depth=6']);
  });

  it('BR-U3-13: two neural ids differing only in unitId differ (via the C6 re-export)', () => {
    const a = computeViolationId({ functionId: 'FF-N01', filePath: 'src/a.ts', discriminator: ['unit-1'] });
    const b = computeViolationId({ functionId: 'FF-N01', filePath: 'src/a.ts', discriminator: ['unit-2'] });
    expect(a).not.toBe(b);
  });

  it('BR-U3-13 static: computeNeuronalViolationId does not exist in src', () => {
    const hits: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.ts') && fs.readFileSync(full, 'utf8').includes('computeNeuronalViolationId')) hits.push(full);
      }
    };
    walk(path.join(ROOT, 'src'));
    expect(hits).toEqual([]);
  });
});

/** T-MAP (U3 business-rules.md §3), all 25 templates after U3-R6: R2's, R4's three, R5's `domain-purity`, R6's `domain-state-purity`. */
const T_MAP: Readonly<Record<string, {
  filePath: string; target?: string; line?: string; lines?: string; isTypeOnly?: string;
  disc: string[]; evid: string[]; cycle?: string;
}>> = {
  'dependency-direction': { filePath: 'source', target: 'target', line: 'line', lines: 'lines', isTypeOnly: 'isTypeOnly', disc: ['relType'], evid: [] },
  'no-cyclic-deps': { filePath: 'cycle', target: 'target', line: 'line', disc: ['cycle'], evid: [], cycle: 'cycle' },
  'no-layer-skip': { filePath: 'source', target: 'target', line: 'line', lines: 'lines', isTypeOnly: 'isTypeOnly', disc: ['relType'], evid: [] },
  'no-domain-outward-dep': { filePath: 'source', target: 'target', line: 'line', lines: 'lines', isTypeOnly: 'isTypeOnly', disc: ['relType'], evid: [] },
  'domain-purity': { filePath: 'source', target: 'target', line: 'line', lines: 'lines', isTypeOnly: 'isTypeOnly', disc: ['relType'], evid: [] },
  'domain-state-purity': { filePath: 'filePath', target: 'target', line: 'line', disc: ['class', 'targetName', 'relType', 'field'], evid: [] },
  'dependency-inversion': { filePath: 'filePath', disc: ['class'], evid: ['ratio'] },
  'repository-pattern': { filePath: 'filePath', disc: ['implementation'], evid: [] },
  'use-case-isolation': { filePath: 'filePath', disc: ['useCase'], evid: [] },
  'controller-no-entity': { filePath: 'filePath', disc: ['controller', 'entity'], evid: [] },
  'domain-stability': { filePath: 'filePath', disc: [], evid: ['instability'] },
  'module-fan-out': { filePath: 'filePath', disc: [], evid: ['fanOut'] },
  'component-instability': { filePath: 'filePath', disc: [], evid: ['instability'] },
  'no-orphan-files': { filePath: 'filePath', disc: [], evid: [] },
  'max-fan-in': { filePath: 'filePath', disc: [], evid: ['fanIn'] },
  'abstraction-ratio': { filePath: 'filePath', disc: [], evid: ['ratio'] },
  'single-responsibility-proxy': { filePath: 'filePath', disc: ['class'], evid: ['methodCount', 'depCount'] },
  'interface-segregation-proxy': { filePath: 'filePath', disc: ['interface'], evid: ['methodCount'] },
  'inheritance-depth': { filePath: 'filePath', disc: ['class'], evid: ['depth'] },
  'naming-conventions': { filePath: 'filePath', disc: ['class'], evid: [] },
  'naming-services': { filePath: 'filePath', disc: ['class'], evid: [] },
  'naming-repos': { filePath: 'filePath', disc: ['class'], evid: [] },
  'naming-controllers': { filePath: 'filePath', disc: ['class'], evid: [] },
  'test-file-pairing': { filePath: 'filePath', disc: [], evid: [] },
  'no-index-logic': { filePath: 'filePath', disc: [], evid: ['declCount'] },
};

/** Templates whose T-MAP row lands with a later R commit (plan Step 13): none since U3-R5 (R4 rows since U3-R4). */
const LATER_R: readonly string[] = [];

const MEASURED = ['fanIn', 'fanOut', 'instability', 'depth', 'ratio', 'methodCount', 'depCount', 'declCount'];

describe('BR-U3-06 / BR-U3-66 T-MAP and TEMPLATE_DISCRIMINATORS (static)', () => {
  it('every template is either mapped by R2 or waits for its R commit', () => {
    expect([...CYPHER_TEMPLATES.keys()].sort()).toEqual([...Object.keys(T_MAP), ...LATER_R].sort());
  });

  it.each(Object.keys(T_MAP))('%s mapping equals its T-MAP row', (name) => {
    const rm = mappingOf(name);
    const row = must(T_MAP[name], name);
    expect({
      filePath: rm.filePathColumn, target: rm.targetColumn, line: rm.lineColumn, lines: rm.linesColumn,
      isTypeOnly: rm.isTypeOnlyColumn, disc: rm.discriminatorColumns, evid: rm.evidenceColumns ?? [], cycle: rm.cycleColumn,
    }).toEqual({
      filePath: row.filePath, target: row.target, line: row.line, lines: row.lines,
      isTypeOnly: row.isTypeOnly, disc: row.disc, evid: row.evid, cycle: row.cycle,
    });
  });

  it.each([...CYPHER_TEMPLATES.keys()])('%s: no column in both lists and no measured column in disc', (name) => {
    const rm = mappingOf(name);
    const evid = rm.evidenceColumns ?? [];
    expect(rm.discriminatorColumns.filter((c) => evid.includes(c))).toEqual([]);
    expect(rm.discriminatorColumns.filter((c) => MEASURED.includes(c))).toEqual([]);
  });

  it('TEMPLATE_DISCRIMINATORS equals the registry, template by template', () => {
    expect(Object.keys(TEMPLATE_DISCRIMINATORS).sort()).toEqual([...CYPHER_TEMPLATES.keys()].sort());
    for (const [name, t] of CYPHER_TEMPLATES) {
      expect({ name, disc: TEMPLATE_DISCRIMINATORS[name] }).toEqual({ name, disc: t.resultMapping.discriminatorColumns });
    }
    expect(Object.isFrozen(TEMPLATE_DISCRIMINATORS)).toBe(true);
  });

  it('messages are unchanged by R2 (dependency templates and cycle pinned)', () => {
    expect(mappingOf('dependency-direction').messageTemplate).toBe('{source} ({srcLayer}) {verb} from {target} ({tgtLayer})');
    expect(mappingOf('no-cyclic-deps').messageTemplate).toBe('Circular dependency: {cycle}');
    expect(mappingOf('abstraction-ratio').messageTemplate).toBe('Abstraction ratio {ratio} below threshold');
    for (const name of Object.keys(T_MAP).filter((n) => T_MAP[n]?.filePath === 'filePath' && n !== 'abstraction-ratio' && n !== 'domain-state-purity')) {
      expect({ name, m: mappingOf(name).messageTemplate }).toEqual({ name, m: 'Violation in {filePath}' });
    }
  });
});
