/**
 * U5 evasion check, the s2d-01 §5 extras (design §2.5a): size per step from the records, import kinds and barrels
 * from the trees, and the mechanism share with missing logs counted apart. Hand-built records; no model.
 */
import type { StepProcess, StepRecord } from '../../../../../scripts/lib/loop/types.js';
import { importKindsByStep, mechanism, sizeByStep, treeKinds } from '../../../../../scripts/v1.3/lib/evasion/extras.js';
import { loadedRuns, oneRun } from './helpers.js';

const proc = (calls: number, logFound = true): StepProcess => ({
  schema: 'loop-process/v1', logs: [], logFound, calls, errors: 0, callsByTool: {}, firstCallAt: null, firstCallBeforeFirstWrite: null, firstWriteEvidence: 'none', latencyMs: { p50: null, p95: null },
});

describe('§5.2 size and §5.3 import kinds', () => {
  it('LOC and files per step come from the step records (from fromStep)', () => {
    const runs = loadedRuns([{ caseName: 'wrapped', arm: 'none' }, { caseName: 'inlined', arm: 'none' }]).map((r) => r.steps);
    const s = sizeByStep(runs, 2);
    expect(Object.keys(s.locByStep)).toEqual(['2']);
    expect(s.locByStep['2']).toEqual({ n: 2, mean: 20, min: 20, max: 20 });
  });

  it('import kinds and barrels per tree, summed per step', () => {
    const t = { files: new Map(Object.entries({ 'src/a.ts': "import('./b');\nconst c = require('./c');\n", 'src/index.ts': "export * from './a';\n", 'src/b.ts': '', 'src/c.ts': '' })) };
    const k = treeKinds(t);
    expect(k.importKinds).toMatchObject({ dynamic: 1, require: 1, reexport: 1 });
    expect(k.barrels).toBe(1);
    const by = importKindsByStep([{ step: 2, kinds: k }, { step: 2, kinds: k }]);
    expect(by.byStep['2']).toMatchObject({ dynamic: 2, snapshots: 2 });
    expect(by.barrelsByStep['2']).toBe(2);
  });
});

describe('§5.6 mechanism', () => {
  it('share over logged steps, missing logs apart, noMechanism below 0.8', () => {
    const base = oneRun({ caseName: 'wrapped', arm: 'daedalus-mcp' }).steps;
    const mk = (p: (StepProcess | undefined)[]): StepRecord[] => base.map((s, i) => ({ ...s, ...(p[i] !== undefined ? { process: p[i] } : {}) }));
    const m = mechanism([mk([proc(0), proc(2)]), mk([proc(1), proc(0, false)]), mk([proc(1), undefined])], 2);
    expect(m).toEqual({ steps: 3, withCalls: 1, noLog: 2, share: 1, noMechanism: false });
    expect(mechanism([mk([undefined, proc(0)])], 2)).toMatchObject({ share: 0, noMechanism: true });
    expect(mechanism([mk([undefined, undefined])], 2)).toMatchObject({ share: null, noMechanism: true });
  });
});
