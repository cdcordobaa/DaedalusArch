/**
 * T-ID (U4 design §5): the identity module (ID-1 to ID-10). Pure, plus one read-only pass over the committed
 * `results/v1.3-fixes-mined/repos/*\/pairs.json.gz` (one repository in memory at a time). No Neo4j.
 */
import * as path from 'node:path';
import { canonicalCycle, violationKey } from '../../../../scripts/v1.3/lib/fixes-mined.js';
import { findingIdentity } from '../../../../scripts/lib/loop/pilot-metrics.js';
import type { BlockingFinding } from '../../../../scripts/lib/loop/types.js';
import {
  assertSameContext, edgeKeys, fineKey, fromBlockingFinding, fromMined, fromProbeFinding, mapFinding, memoKey,
} from '../../../../scripts/lib/drift/identity.js';
import { forEachMinedRepo } from '../../../../scripts/lib/drift/metrics.js';
import type { IdFinding } from '../../../../scripts/lib/drift/types.js';

const MINED = path.resolve(__dirname, '../../../../results/v1.3-fixes-mined');
const EDGE = { cycleIdentity: 'edge-set', edgeOnly: true } as const;

describe('fineKey is violationKey (ID-3)', () => {
  // The fixture cases of tests/unit/scripts/v1.3/fixes-mined.test.ts.
  const dep = { functionId: 'FF-S01', filePath: 'src/a.ts', target: 'src/b.ts' };
  const c1 = { functionId: 'FF-S02', filePath: 'a,b,c,a', target: 'b', discriminator: ['["a.ts","b.ts","c.ts","a.ts"]'] };
  const c2 = { functionId: 'FF-S02', filePath: 'b,c,a,b', target: 'c', discriminator: ['["b.ts","c.ts","a.ts","b.ts"]'] };
  const pkg = { functionId: 'FF-P01', filePath: 'src/d.ts', target: '@nestjs/common' };
  const metric = { functionId: 'FF-C02', filePath: 'src/d.ts' };
  it.each([dep, { ...dep, discriminator: ['IMPORTS'] }, c1, c2, pkg, metric])('parity on %j', (v) => {
    expect(fineKey(fromMined(v))).toBe(violationKey(v));
  });
  it('rotation never changes K', () => {
    expect(fineKey(fromMined(c1))).toBe(fineKey(fromMined(c2)));
  });
});

describe('adapter round trip on the committed pair records (T-ID)', () => {
  let records = 0;
  let cycles = 0;
  const mismatches: string[] = [];
  beforeAll(() => {
    forEachMinedRepo(MINED, (r) => {
      for (const p of r.pairs) {
        for (const f of [...p.introduced, ...p.disappeared]) {
          records++;
          let rebuilt: string;
          if (f.filePath.includes(',')) {
            // Informative: the cycle key rebuilt from the stored comma-list filePath through canonicalCycle.
            cycles++;
            rebuilt = fineKey(fromMined({ functionId: f.functionId, filePath: f.filePath, target: f.target }));
            expect(rebuilt).toBe(`${f.functionId}#cycle#${canonicalCycle(f.filePath.split(',')).join('>')}`);
          } else {
            // Adapter and schema check only: the discriminator is rebuilt from the key's fourth segment.
            const disc = f.key.split('#')[3] ?? '';
            rebuilt = fineKey(fromMined({ functionId: f.functionId, filePath: f.filePath, target: f.target, discriminator: disc === '' ? undefined : disc.split(';') }));
          }
          if (rebuilt !== f.key) mismatches.push(`${r.entry.id} ${f.key} -> ${rebuilt}`);
        }
      }
    });
  });
  it('non-cycle records: fromMined reproduces the stored key (an adapter check, not an identity test)', () => {
    expect(records - cycles).toBe(4408);
    expect(mismatches).toEqual([]);
  });
  it('all 2,239 FF-S02 cycle records rebuild their stored key from the comma list', () => {
    expect(cycles).toBe(2239);
    expect(mismatches).toEqual([]);
  });
});

describe('edge key E (ID-5 to ID-8)', () => {
  it('FF-S01 and FF-S03 on one edge share one E', () => {
    const a = edgeKeys({ functionId: 'FF-S01', filePath: 'src/p/db.ts', target: 'src/b/m.ts' }, EDGE);
    const b = edgeKeys({ functionId: 'FF-S03', filePath: 'src/p/db.ts', target: 'src/b/m.ts' }, EDGE);
    expect(a).toEqual(['src/p/db.ts|src/b/m.ts']);
    expect(b).toEqual(a);
  });
  const cyc: IdFinding = { functionId: 'FF-S02', filePath: 'c.ts,a.ts,b.ts,c.ts' };
  const rot: IdFinding = { functionId: 'FF-S02', filePath: 'a.ts,b.ts,c.ts,a.ts' };
  const rev: IdFinding = { functionId: 'FF-S02', filePath: 'a.ts,c.ts,b.ts,a.ts' };
  it('edge-set: one key, the sorted directed edges; direction is kept', () => {
    const k = edgeKeys(cyc, { cycleIdentity: 'edge-set', edgeOnly: true });
    expect(k).toEqual(['cycle-edges#a.ts|b.ts;b.ts|c.ts;c.ts|a.ts']);
    expect(edgeKeys(rot, { cycleIdentity: 'edge-set', edgeOnly: true })).toEqual(k);
    expect(edgeKeys(rev, { cycleIdentity: 'edge-set', edgeOnly: true })).not.toEqual(k);
  });
  it('sorted-files: one key, the file set; the reverse cycle collides', () => {
    const k = edgeKeys(cyc, { cycleIdentity: 'sorted-files', edgeOnly: true });
    expect(k).toEqual(['cycle-files#a.ts;b.ts;c.ts']);
    expect(edgeKeys(rev, { cycleIdentity: 'sorted-files', edgeOnly: true })).toEqual(k);
  });
  it('explode-edges: one E per directed edge, shared with a plain FF-S01 on that edge (ID-8)', () => {
    const k = edgeKeys(cyc, { cycleIdentity: 'explode-edges', edgeOnly: true });
    expect([...k].sort()).toEqual(['a.ts|b.ts', 'b.ts|c.ts', 'c.ts|a.ts']);
    expect(k).toContain(edgeKeys({ functionId: 'FF-S01', filePath: 'a.ts', target: 'b.ts' }, EDGE)[0]);
  });
  it('a file-level finding has no E under edgeOnly, and E = K otherwise (ID-7)', () => {
    const f = { functionId: 'FF-C02', filePath: 'src/d.ts' };
    expect(edgeKeys(f, { cycleIdentity: 'edge-set', edgeOnly: true })).toEqual([]);
    expect(edgeKeys(f, { cycleIdentity: 'edge-set', edgeOnly: false })).toEqual([fineKey(f)]);
  });
});

describe('mapFinding applies ρ to the finding, never to the key (ID-10)', () => {
  it('a path containing # is mapped exactly', () => {
    const f: IdFinding = { functionId: 'FF-S01', filePath: 'src/#x/a.ts', target: 'src/b.ts' };
    const m = mapFinding(f, new Map([['src/#x/a.ts', 'src/#y/a.ts']]));
    expect(m.filePath).toBe('src/#y/a.ts');
    expect(fineKey(m)).toBe('FF-S01#src/#y/a.ts#src/b.ts#');
  });
  it('a JSON cycle discriminator is mapped member by member', () => {
    const f: IdFinding = { functionId: 'FF-S02', filePath: 'a.ts,b.ts,a.ts', discriminator: ['["a.ts","b.ts","a.ts"]'] };
    const m = mapFinding(f, new Map([['b.ts', 'z.ts']]));
    expect(m.discriminator).toEqual(['["a.ts","z.ts","a.ts"]']);
    expect(m.filePath).toBe('a.ts,z.ts,a.ts');
    expect(fineKey(m)).toBe('FF-S02#cycle#a.ts>z.ts');
  });
  it('a class-name discriminator is left alone', () => {
    const f: IdFinding = { functionId: 'FF-DT01', filePath: 'src/a.ts', target: 'src/b.ts', discriminator: ['UserService'] };
    const m = mapFinding(f, new Map([['src/a.ts', 'src/c.ts'], ['UserService', 'Other']]));
    expect(m.discriminator).toEqual(['UserService']);
    expect(m.filePath).toBe('src/c.ts');
  });
  it('G08 §2.5 example 3: [b,c,a,b] and [a,b,c,a] are one key', () => {
    expect(fineKey({ functionId: 'FF-S02', filePath: 'b,c,a,b' })).toBe(fineKey({ functionId: 'FF-S02', filePath: 'a,b,c,a' }));
  });
  it('a rename that changes the smallest cycle node re-canonicalises the key', () => {
    const f: IdFinding = { functionId: 'FF-S02', filePath: 'b.ts,c.ts,d.ts,b.ts' };
    const m = mapFinding(f, new Map([['d.ts', 'a.ts']]));
    expect(fineKey(m)).toBe('FF-S02#cycle#a.ts>b.ts>c.ts');
    expect(fineKey(m)).toBe(fineKey({ functionId: 'FF-S02', filePath: 'a.ts,b.ts,c.ts,a.ts' }));
  });
});

describe('memoKey reproduces findingIdentity (D-8)', () => {
  const bf = (o: Partial<BlockingFinding>): BlockingFinding => ({ ruleId: 'FF-S01', ruleName: 'Layer dependency', filePath: 'src/a.ts', target: 'src/b.ts', message: 'm', ...o });
  it.each([
    bf({}),
    bf({ template: 'layer-dependency' }),
    { ruleId: 'FF-S01', ruleName: 'Layer dependency', filePath: 'src/a.ts', message: 'm' },
    bf({ ruleId: 'FF-S02', ruleName: 'No cyclic dependencies', template: 'cyclic-dependency', filePath: 'src/b.ts', target: 'src/a.ts' }),
    { ruleId: 'FF-S02', ruleName: 'Cycle', filePath: 'src/a.ts', target: 'src/b.ts', message: 'm' },
  ])('on %j', (b) => {
    expect(memoKey(fromBlockingFinding(b))).toBe(findingIdentity(b));
  });
});

describe('adapters and the degraded cycle key (ID-4)', () => {
  it('a loop cycle without its member list is flagged and keyed from {filePath, target}', () => {
    const b: BlockingFinding = { ruleId: 'FF-S02', ruleName: 'No cyclic dependencies', template: 'cyclic-dependency', filePath: 'src/a.ts', target: 'src/b.ts', message: 'm', violationId: 'v1' };
    const f = fromBlockingFinding(b);
    expect(f.cycleMembersKnown).toBe(false);
    expect(edgeKeys(f, EDGE)).toEqual(['cycle-files#src/a.ts;src/b.ts']);
  });
  it('the report violation beside the turn supplies the members, and the flag goes away', () => {
    const b: BlockingFinding = { ruleId: 'FF-S02', ruleName: 'No cyclic dependencies', filePath: 'src/a.ts', target: 'src/b.ts', message: 'm', violationId: 'v1' };
    const f = fromBlockingFinding(b, [{ id: 'v0', filePath: 'x' }, { id: 'v1', filePath: 'src/a.ts,src/b.ts,src/c.ts,src/a.ts', discriminator: ['["src/a.ts","src/b.ts","src/c.ts","src/a.ts"]'] }]);
    expect(f.cycleMembersKnown).toBeUndefined();
    expect(fineKey(f)).toBe('FF-S02#cycle#src/a.ts>src/b.ts>src/c.ts');
  });
  it('a probe finding becomes a blocking IdFinding', () => {
    expect(fromProbeFinding({ rule: 'FF-S01', file: 'src/a.ts', target: 'src/b.ts' })).toEqual({ functionId: 'FF-S01', filePath: 'src/a.ts', target: 'src/b.ts', tier: 'blocking' });
  });
  it('snapshots of two contexts are an input error (ID-1)', () => {
    expect(() => { assertSameContext([{ id: 'a', contextId: 'x' }, { id: 'b', contextId: 'y' }]); }).toThrow(/ID-1/);
    expect(() => { assertSameContext([{ id: 'a', contextId: 'x' }, { id: 'b', contextId: 'x' }]); }).not.toThrow();
  });
});
