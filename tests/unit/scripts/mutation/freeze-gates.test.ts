/**
 * Freeze tooling (U5a plan Step 34; Q1, Q4, Q11; BR-U5a-36, 37, 56; D-U5a-13, D-U5a-15):
 * - BR-U5a-37 `sitesPerOperator` rule on synthetic feasibility tables (incl. the twin/judge-probe exclusion);
 * - `compareDeclaredKeys` on synthetic detector keys (BR-U5a-36 a);
 * - gates (b) and (c) on correct-reference and the two writers;
 * - `scripts/u5a-freeze-gate.ts` refusal and wiring (fake evaluator), `scripts/u5a-parity-check.ts` `main`.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import { CLI_ENTRY, DECLARATION_GATE_FILE, FREEZE_GATE_REFUSAL, cliEvaluate, main as freezeGateMain, violationsFromOutput } from '../../../../scripts/lib/freeze-gate-main.js';
import type { Evaluate } from '../../../../scripts/lib/freeze-gate-main.js';
import type { ProcessRunOptions, ProcessRunner } from '../../../../src/shared/interfaces/process-runner.js';
import type { ManifestRow } from '../../../../scripts/lib/manifest.js';
import {
  BASE_TYPECHECK_STEM,
  SITE_FEASIBILITY_STEM,
  chooseSitesPerOperator,
  compareDeclaredKeys,
  heldOutTotals,
  isGoldenInstanceOperator,
  keyString,
  measureBaseTypecheck,
  siteFeasibility,
  subsampleInstances,
  writeBaseTypecheckTable,
  writeSiteFeasibilityTable,
} from '../../../../scripts/lib/mutation/freeze-gates.js';
import type { SiteFeasibilityRow, ViolationKeyInput } from '../../../../scripts/lib/mutation/freeze-gates.js';
import { CATALOGUE_OPERATORS, MASTER_SEED } from '../../../../scripts/lib/mutation/operators/index.js';
import { SP_OPERATORS } from '../../../../scripts/lib/mutation/operators/sp/index.js';
import { compareImportGraphs } from '../../../../scripts/lib/import-graph-parity.js';
import { main as parityMain } from '../../../../scripts/lib/parity-check-main.js';
import { CLEAN_SPEC, CORRECT_DIR, REPO, applyForced, fixtureBase } from './operator-harness.js';
import { FORCED_SITES } from './forced-sites.js';

jest.setTimeout(600_000);

const runner = new NodeProcessRunner();
let scratch: string;
beforeAll(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-freeze-'));
});
afterAll(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

function fr(projectId: string, operatorId: string, eligible: number, split: 'dev' | 'held-out' = 'held-out'): SiteFeasibilityRow {
  return { projectId, split, operatorId, candidates: eligible, rejectedByReason: {}, eligible, takenAtK2: Math.min(2, eligible), takenAtK3: Math.min(3, eligible) };
}

/** `n2` rows with eligible 2 and `n3` rows with eligible ≥ 3 on held-out bases (k2 = 2·(n2+n3), k3 = 2·n2 + 3·n3). */
function table(n2: number, n3: number, extra: SiteFeasibilityRow[] = []): SiteFeasibilityRow[] {
  const rows: SiteFeasibilityRow[] = [];
  for (let i = 0; i < n2; i++) rows.push(fr(`p${String(i).padStart(3, '0')}`, 'MO-S01', 2));
  for (let i = 0; i < n3; i++) rows.push(fr(`q${String(i).padStart(3, '0')}`, 'MO-P01', 5));
  return [...rows, ...extra];
}

describe('BR-U5a-37 sitesPerOperator rule (synthetic tables)', () => {
  it('twin and judge-probe rows (and dev rows) never lift the total: 70 at k = 2 stays 70', () => {
    const golden = table(35, 0, [fr('dev-fixture', 'MO-S01', 3, 'dev')]);
    const twinsAndJudgeProbes = table(10, 0).map((r) => ({ ...r, operatorId: 'MO-S01n' }));
    expect(heldOutTotals(golden)).toEqual({ k2: 70, k3: 70 });
    expect(heldOutTotals([...golden, ...twinsAndJudgeProbes]).k2).toBe(90);
    const c = chooseSitesPerOperator({ golden }, MASTER_SEED);
    expect(!c.success && [c.errors[0]?.code, c.errors[0]?.context]).toEqual(['CAT_SHORTFALL', { totalAtK2: 70, totalAtK3: 70 }]);
    // the classification the table relies on: symbolic positives only (BR-U5a-01)
    const golden22 = CATALOGUE_OPERATORS.filter(isGoldenInstanceOperator).map((o) => o.id);
    expect(golden22).toEqual(['MO-S01', 'MO-P01', 'MO-C04', 'MO-SO01', 'MO-CV02', 'MO-DF01', 'MO-X01', 'MO-SO02', 'MO-S03']);
    expect(SP_OPERATORS.some(isGoldenInstanceOperator)).toBe(false);
  });

  it('85 at k = 2 → k = 2', () => {
    const c = chooseSitesPerOperator({ golden: table(40, 0, [fr('r', 'MO-C04', 5), fr('s', 'MO-C04', 1), fr('t', 'MO-C04', 1), fr('u', 'MO-C04', 1)]) }, MASTER_SEED);
    expect(c.success && [c.data.k, c.data.totalAtK2, c.data.total, c.data.subsample]).toEqual([2, 85, 85, undefined]);
  });

  it('70 at k = 2 and 104 at k = 3 → k = 3', () => {
    const c = chooseSitesPerOperator({ golden: table(1, 34) }, MASTER_SEED);
    expect(c.success && [c.data.k, c.data.totalAtK2, c.data.totalAtK3, c.data.total]).toEqual([3, 70, 104, 104]);
  });

  it('130 at k = 3 → seeded subsample to 120, reproducible; a chosen k = 2 total above 120 is cut the same way (DV-U5a-22)', () => {
    const rows = table(4, 40);
    expect(heldOutTotals(rows)).toEqual({ k2: 88, k3: 128 });
    const rows130 = [...rows, fr('z1', 'MO-SO01', 1), fr('z2', 'MO-SO01', 1)];
    expect(heldOutTotals(rows130).k3).toBe(130);
    const a = subsampleInstances(rows130, 3, MASTER_SEED);
    const b = subsampleInstances(rows130, 3, MASTER_SEED);
    expect(a).toHaveLength(120);
    expect(a).toEqual(b);
    expect(new Set(a.map((i) => JSON.stringify(i))).size).toBe(120);
    for (const i of a) expect(i.k).toBeLessThan(rows130.find((r) => r.projectId === i.projectId)?.takenAtK3 ?? 0);
    expect(subsampleInstances(rows130, 3, MASTER_SEED + 1)).not.toEqual(a);
    const big = table(65, 0);
    const c = chooseSitesPerOperator({ golden: big }, MASTER_SEED);
    expect(c.success && [c.data.k, c.data.totalAtK2, c.data.total, c.data.subsample?.length]).toEqual([2, 130, 120, 120]);
  });

  it('60 at k = 3 → CAT_SHORTFALL (no k chosen)', () => {
    const c = chooseSitesPerOperator({ golden: table(0, 20) }, MASTER_SEED);
    expect(heldOutTotals(table(0, 20))).toEqual({ k2: 40, k3: 60 });
    expect(!c.success && c.errors[0]?.code).toBe('CAT_SHORTFALL');
  });
});

describe('compareDeclaredKeys (BR-U5a-36 a, synthetic detector keys)', () => {
  const k = (functionId: string, filePath: string, target = '', discriminator: string[] = []): ViolationKeyInput => ({ functionId, filePath, target, discriminator });
  const ek = (v: ViolationKeyInput, line?: number): Record<string, unknown> => ({ ...v, lineRule: line === undefined ? 'none' : 'site-line', ...(line !== undefined ? { line } : {}) });
  const base = [k('FF-C03', 'src/a.ts'), k('FF-CV05', 'src/a.ts')];
  function row(expected: Record<string, unknown>, id = 'MO-S01'): ManifestRow {
    return { seedId: `p:${id}:0`, operatorId: id, expected } as unknown as ManifestRow;
  }
  const s01 = k('FF-S01', 'src/d.ts', 'src/i.ts', ['IMPORTS']);
  const positive = (collateral: unknown[] = []): ManifestRow =>
    row({ functionIds: ['FF-S01'], disabledFunctionIds: [], absentTemplates: [], dimension: 'structural', keys: [ek(s01, 1)], collateral, coverage: 'in' });

  it('a positive whose expected key fires and nothing else is new passes; baseline keys are not new', () => {
    const r = compareDeclaredKeys({ violations: base }, { violations: [...base, s01] }, positive());
    expect([r.passed, r.newKeys, r.undeclared, r.missingExpected]).toEqual([true, [keyString(s01)], [], false]);
  });

  it('an undeclared key on a positive fails; declaring it as collateral passes', () => {
    const extra = k('FF-S02', 'src/d.ts,src/i.ts,src/d.ts', 'src/i.ts', ['["src/d.ts","src/i.ts","src/d.ts"]']);
    const r = compareDeclaredKeys({ violations: base }, { violations: [...base, s01, extra] }, positive());
    expect([r.passed, r.undeclared]).toEqual([false, [keyString(extra)]]);
    const declared = positive([{ kind: 'site', template: 'no-cyclic-deps', functionId: 'FF-S02', cause: 'cycle', key: ek(extra, 1) }]);
    expect(compareDeclaredKeys({ violations: base }, { violations: [...base, s01, extra] }, declared).passed).toBe(true);
  });

  it('an undeclared key on a twin fails', () => {
    const twin = row({ negative: true, twinOf: 'MO-S01', functionIds: [], keys: [], collateral: [], coverage: 'in' }, 'MO-S01n');
    const fired = k('FF-P05', 'src/c.ts', '', ['TaskController', 'Task']);
    const r = compareDeclaredKeys({ violations: base }, { violations: [...base, fired] }, twin);
    expect([r.passed, r.undeclared, r.missingExpected]).toEqual([false, [keyString(fired)], false]);
    expect(compareDeclaredKeys({ violations: base }, { violations: base }, twin).passed).toBe(true);
  });

  it('an in-coverage positive with no expected key among the new keys fails; outside coverage it does not', () => {
    const r = compareDeclaredKeys({ violations: base }, { violations: base }, positive());
    expect([r.passed, r.missingExpected]).toEqual([false, true]);
    const outside = row({ functionIds: ['FF-S01'], disabledFunctionIds: [], absentTemplates: [], dimension: 'structural', keys: [ek(s01, 21)], collateral: [], coverage: 'outside' }, 'MO-X01');
    expect(compareDeclaredKeys({ violations: base }, { violations: base }, outside)).toMatchObject({ passed: true, missingExpected: false });
  });

  it('project-metric exception: a new key of a function declared keyless is not undeclared', () => {
    const ratio = k('FF-C06', '<project>');
    const withMetric = positive([{ kind: 'site', template: 'abstraction-ratio', functionId: 'FF-C06', cause: 'project-metric' }]);
    expect(compareDeclaredKeys({ violations: base }, { violations: [...base, s01, ratio] }, withMetric).passed).toBe(true);
    expect(compareDeclaredKeys({ violations: base }, { violations: [...base, s01, ratio] }, positive()).undeclared).toEqual([keyString(ratio)]);
  });

  it('violationsFromOutput reads the CLI JSON tolerantly', () => {
    const out = `log line\n${JSON.stringify({ violations: [{ functionId: 'FF-S01', filePath: 'a.ts', target: 'b.ts', discriminator: ['IMPORTS'] }, { bad: 1 }] })}`;
    const r = violationsFromOutput(out);
    expect(r.success && r.data.violations).toEqual([{ functionId: 'FF-S01', filePath: 'a.ts', target: 'b.ts', discriminator: ['IMPORTS'] }]);
    expect(violationsFromOutput('no json').success).toBe(false);
    expect(violationsFromOutput('{"x":1}').success).toBe(false);
  });
});

describe('gates (b) and (c) on correct-reference; writers', () => {
  it('(b) correct-reference type-checks clean with the repository tsc; (c) golden and twin/judge sections; both files written', async () => {
    const base = fixtureBase(CLEAN_SPEC);
    const b = await measureBaseTypecheck(runner, [base], scratch);
    expect(b.success && b.data.map((r) => [r.projectId, r.errorCount, r.excluded])).toEqual([['correct-reference', 0, false]]);
    const c = await siteFeasibility(REPO, [{ base, split: 'dev' }], [...CATALOGUE_OPERATORS, ...SP_OPERATORS], scratch);
    if (!c.success) throw new Error(JSON.stringify(c.errors));
    expect(c.data.golden.map((r) => r.operatorId)).toEqual(CATALOGUE_OPERATORS.filter(isGoldenInstanceOperator).map((o) => o.id));
    expect(c.data.twinsAndJudgeProbes).toHaveLength(13);
    const s01 = c.data.golden.find((r) => r.operatorId === 'MO-S01');
    expect(s01 !== undefined && s01.eligible > 0 && s01.takenAtK2 === Math.min(2, s01.eligible)).toBe(true);
    const s03 = c.data.golden.find((r) => r.operatorId === 'MO-S03');
    // clean-arch has no presentation layer: MO-S03 finds no candidate there (it runs under the layered spec)
    expect(s03 !== undefined && [s03.candidates, s03.eligible]).toEqual([0, 0]);
    expect(fs.readdirSync(scratch).filter((d) => d.startsWith('u5a-freeze-'))).toEqual([]);
    const out = path.join(scratch, 'diag');
    const files = [
      ...writeBaseTypecheckTable(out, b.success ? b.data : [], '2026-10-08'),
      ...writeSiteFeasibilityTable(out, c.data, chooseSitesPerOperator(c.data, MASTER_SEED), '2026-10-08'),
    ];
    expect(files.map((f) => path.basename(f))).toEqual([`${BASE_TYPECHECK_STEM}.json`, `${BASE_TYPECHECK_STEM}.md`, `${SITE_FEASIBILITY_STEM}.json`, `${SITE_FEASIBILITY_STEM}.md`]);
    expect(fs.readFileSync(path.join(out, `${SITE_FEASIBILITY_STEM}.md`), 'utf8')).toContain('## Twins and judge probes (sampled with the same k, not counted)');
    expect(fs.readFileSync(path.join(out, `${SITE_FEASIBILITY_STEM}.md`), 'utf8')).toContain('CAT_SHORTFALL');
  });
});

describe('scripts/u5a-freeze-gate.ts main', () => {
  const capture = (): { out: string[]; err: string[] } => ({ out: [], err: [] });

  it('refuses without GOLDEN_REQUIRED=1 and NEO4J_URI (exit 2, refusal message)', async () => {
    for (const env of [{}, { GOLDEN_REQUIRED: '1' }, { NEO4J_URI: 'bolt://localhost:7691' }]) {
      const c = capture();
      expect(await freezeGateMain([], REPO, { env, out: (t) => c.out.push(t), err: (t) => c.err.push(t) })).toBe(2);
      expect(c.err.join('')).toContain(FREEZE_GATE_REFUSAL);
    }
  });

  it('cliEvaluate runs the entry that calls main() (bin/firewall.ts) with the explicit environment only', async () => {
    expect(CLI_ENTRY).toBe('bin/firewall.ts');
    expect(fs.readFileSync(path.join(REPO, CLI_ENTRY), 'utf8')).toMatch(/\bmain\(\)/);
    const seen: { command: string; args: readonly string[]; options: ProcessRunOptions }[] = [];
    const fake: ProcessRunner = {
      run: (command, args, options) => {
        seen.push({ command, args, options });
        const stdout = JSON.stringify({ violations: [{ functionId: 'FF-S01', filePath: 'src/domain/Task.ts', target: 't', discriminator: ['a'] }] });
        return Promise.resolve(DomainResult.ok({ exitCode: 1, stdout, stderr: '', timedOut: false, durationMs: 1 }));
      },
    };
    const env = { PATH: '/bin', HOME: '/h', NEO4J_URI: 'bolt://localhost:7691', NEO4J_USER: 'u', NEO4J_PASSWORD: 'p', OTHER: 'x' };
    const r = await cliEvaluate(fake, REPO, env)('/tmp/copy', 'specs/clean-arch.yaml');
    expect(r.success && r.data.violations).toEqual([{ functionId: 'FF-S01', filePath: 'src/domain/Task.ts', target: 't', discriminator: ['a'] }]);
    expect(seen).toHaveLength(1);
    const call = seen[0];
    if (call === undefined) throw new Error('call');
    expect(call.command).toBe(path.resolve(REPO, 'node_modules/.bin/tsx'));
    expect(call.args).toEqual([
      'bin/firewall.ts', 'evaluate', '--project', '/tmp/copy', '--spec', 'specs/clean-arch.yaml', '--format', 'json', '--symbolic-only', '--neo4j-uri', 'bolt://localhost:7691',
    ]);
    expect(call.options.cwd).toBe(REPO);
    expect(Object.keys(call.options.env).sort()).toEqual(['HOME', 'NEO4J_PASSWORD', 'NEO4J_URI', 'NEO4J_USER', 'PATH']);
  });

  it('evaluates baseline and copies through the evaluator and fails on an undeclared key (fake evaluator)', async () => {
    const s01 = FORCED_SITES.find((f) => f.id === 'MO-S01');
    if (s01 === undefined) throw new Error('sites');
    const a = await applyForced(scratch, CATALOGUE_OPERATORS, 'MO-S01', fixtureBase(CLEAN_SPEC), s01.site);
    const manifestPath = path.join(path.dirname(path.dirname(path.dirname(path.dirname(a.copy)))), 'manifest.json');
    const copies = path.dirname(path.dirname(path.dirname(a.copy)));
    const row = a.row;
    if (row === undefined) throw new Error('row');
    const calls: string[] = [];
    const keysOf = (r: ManifestRow): ViolationKeyInput[] => [...r.expected.keys, ...r.expected.collateral.flatMap((c) => (c.key !== undefined ? [c.key] : []))];
    const good: Evaluate = (dir) => {
      calls.push(dir);
      return Promise.resolve(DomainResult.ok({ violations: dir === CORRECT_DIR ? [] : keysOf(row) }));
    };
    const c = capture();
    const env = { GOLDEN_REQUIRED: '1', NEO4J_URI: 'bolt://localhost:7691' };
    const args = ['--manifest', manifestPath, '--copies', copies, '--base', 'fixtures/correct-reference', '--out', path.join(scratch, 'gate')];
    expect(await freezeGateMain(args, REPO, { env, evaluate: good, out: (t) => c.out.push(t), err: (t) => c.err.push(t) })).toBe(0);
    expect(calls).toEqual([CORRECT_DIR, a.copy]);
    expect(c.out.join('')).toContain(`PASS ${row.seedId}`);
    const written = JSON.parse(fs.readFileSync(path.join(scratch, 'gate', DECLARATION_GATE_FILE), 'utf8')) as { passed: boolean };
    expect(written.passed).toBe(true);
    const extra: ViolationKeyInput = { functionId: 'FF-P05', filePath: 'src/infrastructure/controllers/TaskController.ts', target: '', discriminator: ['TaskController', 'Task'] };
    const bad: Evaluate = (dir) => Promise.resolve(DomainResult.ok({ violations: dir === CORRECT_DIR ? [] : [...keysOf(row), extra] }));
    const d = capture();
    expect(await freezeGateMain(args, REPO, { env, evaluate: bad, out: (t) => d.out.push(t), err: (t) => d.err.push(t) })).toBe(1);
    expect(d.out.join('')).toContain(`undeclared ${keyString(extra)}`);
  });
});

describe('scripts/u5a-parity-check.ts main (D-U5a-15)', () => {
  function listOf(dirs: string[]): string {
    const list = dirs.map((d) => ({ ...fixtureBase(CLEAN_SPEC, d) }));
    const file = path.join(scratch, `bases-${String(Math.random()).slice(2)}.json`);
    fs.writeFileSync(file, JSON.stringify(list));
    return file;
  }

  it('two fixture copies → exit 0, one OK line each', async () => {
    const dirs = ['correct-reference', 'variant-a-structural'].map((id) => {
      const dest = path.join(scratch, 'parity', id);
      fs.cpSync(path.join(REPO, 'fixtures', id), dest, { recursive: true });
      return dest;
    });
    const out: string[] = [];
    const code = await parityMain(['--bases', listOf(dirs), '--spec', CLEAN_SPEC], REPO, { compare: compareImportGraphs, out: (t) => out.push(t), err: (t) => out.push(t) });
    expect([code, out.join('')]).toEqual([0, 'OK correct-reference\nOK variant-a-structural\n']);
  });

  it('a fake compare reporting one difference → exit 1 and the edge printed', async () => {
    const out: string[] = [];
    const edge = 'edge IMPORTS src/a.ts -> src/b.ts typeOnly=false';
    const code = await parityMain(['--bases', listOf([CORRECT_DIR])], REPO, {
      compare: () => Promise.resolve({ equal: false, onlyInBuilder: [edge], onlyInExtractor: [] }),
      out: (t) => out.push(t),
      err: (t) => out.push(t),
    });
    expect([code, out.join('')]).toEqual([1, `DIFF correct-reference\n  only-builder ${edge}\n`]);
  });

  it('usage errors exit 2', async () => {
    const err: string[] = [];
    expect(await parityMain([], REPO, { compare: () => Promise.reject(new Error('unused')), out: () => undefined, err: (t) => err.push(t) })).toBe(2);
    expect(err.join('')).toContain('--bases is required');
  });
});
