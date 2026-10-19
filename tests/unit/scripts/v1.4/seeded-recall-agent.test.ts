/**
 * Seeded recall on agent snapshots (`scripts/v1.4/lib/seeded-recall-agent.ts`): operator selection per style, row
 * classification against the unmutated snapshot, and the per-style summary. One end-to-end check applies the real
 * MO-S01 operator to a small Layered fixture tree and finds its expected key (no evaluation: the key and the edit only).
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { blockingKeys, classifyRow, isMismatched, operatorsFor, positiveOf, renderRecall, summariseRecall } from '../../../../scripts/v1.4/lib/seeded-recall-agent.js';
import type { FeasibilityCell, RecallRow } from '../../../../scripts/v1.4/lib/seeded-recall-agent.js';
import { loadCompiledSpec } from '../../../../scripts/lib/mutation/expected.js';
import { openImportGraphProject } from '../../../../scripts/lib/mutation/import-graph.js';
import { mulberry32 } from '../../../../scripts/lib/mutation/rng.js';
import { sortSites } from '../../../../scripts/lib/mutation/sites.js';
import { expectedKeys } from '../../../../scripts/v1.3/lib/operators-hexddd.js';
import type { ExpectedKey } from '../../../../scripts/v1.3/lib/operators-hexddd.js';
import { harnessTsconfigText } from '../../../../scripts/lib/generators/harness-tsconfig.js';

const REPO = path.resolve(__dirname, '../../../..');

describe('operatorsFor', () => {
  it('gives every style the in-coverage catalogue operators and no outside-coverage one', () => {
    for (const style of ['layered', 'clean', 'hexagonal', 'ddd']) {
      const ids = operatorsFor(style).map((o) => o.id);
      expect(ids).toEqual(expect.arrayContaining(['MO-S01', 'MO-S01n', 'MO-P01', 'MO-S03']));
      expect(ids.some((i) => i.startsWith('MO-X'))).toBe(false);
    }
  });
  it('adds the hexagonal operators on hexagonal and the DDD ones on ddd only', () => {
    expect(operatorsFor('hexagonal').map((o) => o.id)).toContain('MO-H01');
    expect(operatorsFor('hexagonal').map((o) => o.id)).not.toContain('MO-D01');
    expect(operatorsFor('ddd').map((o) => o.id)).toContain('MO-D01');
    expect(operatorsFor('layered').map((o) => o.id).some((i) => /^MO-[HD]\d/.test(i))).toBe(false);
  });
  it('maps a twin to its positive', () => {
    const twin = operatorsFor('clean').find((o) => o.id === 'MO-S01n');
    expect(twin !== undefined && positiveOf(twin)).toBe('MO-S01');
  });
});

describe('classifyRow', () => {
  const key: ExpectedKey = { template: 'dependency-direction', functionId: 'FF-S01', filePath: 'src/business/a.ts', target: 'src/presentation/c.ts' };
  const old = { functionId: 'FF-S01', filePath: 'src/persistence/db.ts', target: 'src/business/m.ts' };
  const hit = { functionId: 'FF-S01', filePath: 'src/business/a.ts', target: 'src/presentation/c.ts' };
  it('detects a positive only on a violation the unmutated snapshot lacks', () => {
    expect(classifyRow('positive', [key], [old], [old, hit], 'layered').status).toBe('detected');
    expect(classifyRow('positive', [key], [old, hit], [old, hit], 'layered').status).toBe('missed');
    expect(classifyRow('positive', [key], [], [], 'layered')).toEqual({ status: 'missed', hits: [false], newBlocking: [] });
  });
  it('has no key when the spec enables none of the templates', () => {
    expect(classifyRow('positive', [], [], [hit], 'layered').status).toBe('no-expected-key');
  });
  it('calls a twin a false fire on a new blocking violation only', () => {
    expect(classifyRow('twin', [], [], [hit], 'layered').status).toBe('false-fire');
    expect(classifyRow('twin', [], [], [{ functionId: 'FF-CV05', filePath: 'src/x.ts' }], 'layered').status).toBe('silent');
  });
  it('tells whether a key is blocking under the style', () => {
    expect(blockingKeys([key], 'layered')).toBe(true);
    expect(blockingKeys([{ ...key, functionId: 'FF-CV05' }], 'layered')).toBe(false);
  });
});

describe('summariseRecall', () => {
  const row = (op: string, status: RecallRow['status'], role: 'positive' | 'twin' = 'positive'): RecallRow => ({
    rowId: `${op}-${status}`, snapshotId: 's1', generator: 'g', task: 't', arm: 'none', style: 'layered', operatorId: op, positiveId: op.replace(/n$/, ''), role,
    site: { filePath: 'src/a.ts', line: 1, kind: 'import-edge', detail: {} }, status,
    expected: role === 'positive' ? [{ template: 'dependency-direction', functionId: 'FF-S01', filePath: 'src/a.ts' }] : [], absentTemplates: [], hits: [], newBlocking: [],
    typecheck: { base: 0, mutant: 0 }, diff: '',
  });
  const cells: FeasibilityCell[] = [
    { snapshotId: 's1', style: 'layered', operatorId: 'MO-S01', candidates: 5, eligible: 3, sampled: 3, rejected: {} },
    { snapshotId: 's1', style: 'layered', operatorId: 'MO-S01n', candidates: 2, eligible: 1, sampled: 1, rejected: {} },
  ];
  it('rates detection per operator and per style, with twins counted as false fires', () => {
    const s = summariseRecall([row('MO-S01', 'detected'), row('MO-S01', 'missed'), row('MO-S01', 'typecheck'), row('MO-S01n', 'false-fire', 'twin')], cells);
    const s01 = s.find((x) => x.operatorId === 'MO-S01');
    expect(s01).toMatchObject({ hits: 1, rate: 0.5, applied: 3, compiled: 2, evaluated: 2, blocking: true, eligible: 3, candidates: 5 });
    expect(s.find((x) => x.operatorId === 'MO-S01n')).toMatchObject({ falseFires: 1, rate: null });
    expect(s.find((x) => x.operatorId === '*')).toMatchObject({ style: 'layered', hits: 1, evaluated: 2, rate: 0.5, snapshots: 1 });
    const md = renderRecall(s);
    expect(md).toContain('| layered | MO-S01 (direction mismatch) | yes | 1 | 3/5 | 3 | 2 | 2 | 1 | 0.50 [');
  });
});

describe('direction-mismatched operators (Layered)', () => {
  const row = (op: string, status: RecallRow['status']): RecallRow => ({
    rowId: `${op}-${status}`, snapshotId: 's1', generator: 'g', task: 't', arm: 'none', style: 'layered', operatorId: op, positiveId: op, role: 'positive',
    site: { filePath: 'src/a.ts', line: 1, kind: 'import-edge', detail: {} }, status,
    expected: [{ template: 'x', functionId: 'FF-S01', filePath: 'src/a.ts' }], absentTemplates: [], hits: [], newBlocking: [], typecheck: { base: 0, mutant: 0 }, diff: '',
  });
  it('flags MO-S01 and MO-DF01 under layered only, and totals the style without them', () => {
    expect(isMismatched('layered', 'MO-S01')).toBe(true);
    expect(isMismatched('clean-architecture', 'MO-S01')).toBe(false);
    const cells: FeasibilityCell[] = ['MO-S01', 'MO-S03'].map((operatorId) => ({ snapshotId: 's1', style: 'layered', operatorId, candidates: 1, eligible: 1, sampled: 1, rejected: {} }));
    const s = summariseRecall([row('MO-S01', 'missed'), row('MO-S03', 'detected')], cells);
    expect(s.find((x) => x.operatorId === '*')).toMatchObject({ hits: 1, evaluated: 2 });
    expect(s.find((x) => x.operatorId === '*-matched')).toMatchObject({ hits: 1, evaluated: 1, rate: 1 });
    expect(renderRecall(s)).toContain('MO-S01 (direction mismatch)');
  });
});

describe('a real operator on a Layered fixture tree', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seeded-recall-'));
    const files: Record<string, string> = {
      'src/persistence/store.ts': 'export class Store { items: string[] = []; }\n',
      'src/business/service.ts': "import { Store } from '../persistence/store';\nexport class Service { constructor(private readonly s: Store) {} count(): number { return this.s.items.length; } }\n",
      'src/presentation/api.ts': "import { Service } from '../business/service';\nexport function handler(s: Service): number { return s.count(); }\n",
    };
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.writeFileSync(path.join(dir, rel), text);
    }
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), harnessTsconfigText(dir));
  });
  afterEach(() => { fs.rmSync(dir, { recursive: true, force: true }); });

  it('MO-S01 adds an inward-pointing edge whose expected key names the dependency-direction function', async () => {
    const compiled = await loadCompiledSpec(REPO, 'presets/layered.yaml');
    expect(compiled.success).toBe(true);
    if (!compiled.success) return;
    const ids = new Map([...compiled.data.enabled.entries()].map(([t, f]) => [t, f.map((x) => x.functionId)]));
    const op = operatorsFor('layered').find((o) => o.id === 'MO-S01');
    expect(op).toBeDefined();
    if (op === undefined) return;
    const handle = openImportGraphProject(dir, 'tsconfig.json');
    const sites = sortSites(op.findSites(handle, compiled.data.spec));
    expect(sites.length).toBeGreaterThan(0);
    const site = sites[0];
    if (site === undefined) return;
    const r = op.apply(handle, site, mulberry32(1));
    expect(r.success).toBe(true);
    if (!r.success) return;
    const { keys } = expectedKeys(op, site, r.data, ids);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((k) => k.functionId.startsWith('FF-S'))).toBe(true);
    expect(blockingKeys(keys, 'layered')).toBe(true);
  });
});
