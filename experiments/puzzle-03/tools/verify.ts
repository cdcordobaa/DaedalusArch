/**
 * PUZZLE-03 mechanical verification (zero calls: no model, no network, no Neo4j). The PUZZLE-01 procedure
 * (`ops/notes/puzzle-01-design.md` §7, `experiments/puzzle-01/tools/verify.ts`), unchanged in what it checks, plus
 * the PUZZLE-03 additions:
 * - **gaming fixtures** (`gaming/<name>/`, declared in `puzzle.json` → `gaming`): working end states that hide a trap
 *   (a rename, a "batch" wrapper, a handler run synchronously). Each must pass the tests and fail the oracle on every
 *   sub-goal it declares;
 * - **alternatives** (`alternatives/<name>/`, `puzzle.json` → `alternatives`): other clean designs, which must pass the
 *   tests and the oracle (a guard against over-rejection);
 * - the **previous oracle** (`puzzle.json` → `previousOracle`, P3r only) is run on every tree, so the gain is shown;
 * - DETECT-02's `check_consistency` (`experiments/detect-02/mcp/push-gate.ts --json`, symbolic, zero calls) on every
 *   tree, next to the frozen instrument.
 * The behaviour-test runner and the instrument scorer are PUZZLE-01's (`experiments/puzzle-01/tools/`), unchanged.
 *
 * Usage (repository root): npx tsx experiments/puzzle-03/tools/verify.ts [--out experiments/puzzle-03/verification.json]
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

const REPO = process.cwd();
const ROOT = 'experiments/puzzle-03';
const P01 = 'experiments/puzzle-01';
const outArg = process.argv.indexOf('--out');
const OUT = outArg >= 0 ? process.argv[outArg + 1]! : `${ROOT}/verification.json`;

/** Revisions made while building, logged instead of fixed silently (design note §2 R8). */
const REVISIONS = [
  { puzzle: 'p3r-shipping-quotes', when: 'build', what: 'rebuilt, not restored: solutions/clean/src/application/ports/out/CarrierRates.ts written anew from its importers (7 lines, as the recorded change size requires); the lost original\'s doc comment is not recoverable (PUZZLE-01 baseline R1), so the clean tree hash differs from puzzle-01/verification.json. TrackingPort.ts in the clean tree is the seed\'s planted file, byte-exact. Seed, trap, tasks, tests and vendor stand-in are the PUZZLE-01 files, byte-exact' },
  { puzzle: 'p3r-shipping-quotes', when: 'build', what: 'oracle extended for gaming (vendor field names declared in the core, vendor codes and declaration names in strings, core imports of adapters); rules (a) are the PUZZLE-01 P3 oracle unchanged. The PUZZLE-01 oracle passes the gaming fixture, the P3r oracle fails it' },
  { puzzle: 'p5-ferry-seats', when: 'build, before the first verification run', what: 'regression test "a scheduled sailing shows its route and seats" compared the whole sailing view with deepEqual, which would fail any end state that adds a field (the clean and trap lines both add `cancelled`); it now compares the five seed fields' },
  { puzzle: 'p6-workshop-jobs', when: 'build, before the first verification run', what: 'feature test "monthly takings per mechanic" had two mechanics on equal takings (an order the request does not fix); one job\'s labour was raised from 45 to 60 minutes so the order is determined' },
];

/** Hand reading of the instrument's view per sub-goal (coordinator, after the mechanical run). */
const HAND_READING: Record<string, string> = {
  'p3r-shipping-quotes/trap/SG1': 'invisible: vendor types in an application port raise nothing (H5 class iv), as in PUZZLE-01',
  'p3r-shipping-quotes/trap/SG2': 'invisible: FF-P01 checks the vendor package only in the domain layer; the runtime import is in the application layer',
  'p5-ferry-seats/trap/SG1': 'invisible to the frozen instrument (the write goes through the published module of the other context; no import rule broken). DETECT-02 check_consistency: see the detect02 column',
  'p5-ferry-seats/trap/SG2': 'invisible to the frozen instrument, as SG1',
  'p6-workshop-jobs/trap/SG1': 'visible: one new correct FF-S03 (no-layer-skip) finding, ReportsController -> persistence/MechanicGateway. A trap that reuses only the planted JobGateway import would add no new import edge and would not be seen (the oracle still fails it)',
};

interface Json { [k: string]: unknown }
interface Meta {
  subGoals: { id: string; family: string }[];
  spec: string;
  gaming?: { tree: string; subGoals: string[]; what: string }[];
  alternatives?: { tree: string; what: string }[];
  previousOracle?: string;
}
const tsx = (args: string[]): { code: number; out: Json | null; err: string } => {
  const r = spawnSync('npx', ['tsx', ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const line = (r.stdout ?? '').trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
  return { code: r.status ?? -1, out: line === undefined ? null : (JSON.parse(line) as Json), err: (r.stderr ?? '').slice(0, 2000) };
};
const tsxWhole = (args: string[]): { code: number; out: Json | null; err: string } => {
  const r = spawnSync('npx', ['tsx', ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const s = (r.stdout ?? '').trim();
  const at = s.indexOf('{');
  return { code: r.status ?? -1, out: at < 0 ? null : (JSON.parse(s.slice(at)) as Json), err: (r.stderr ?? '').slice(0, 2000) };
};

function typecheck(tree: string): { errors: number; first: string[] } {
  const files: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) files.push(p);
    }
  };
  walk(path.join(tree, 'src'));
  const program = ts.createProgram(files, {
    strict: true, target: ts.ScriptTarget.ES2022, lib: ['lib.es2022.d.ts'], module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10,
    esModuleInterop: true, skipLibCheck: true, forceConsistentCasingInFileNames: true, noEmit: true,
    typeRoots: [path.join(REPO, 'node_modules/@types')], types: ['node'],
  });
  const diags = ts.getPreEmitDiagnostics(program);
  return { errors: diags.length, first: diags.slice(0, 5).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')) };
}

function size(seed: string, tree: string): { files: number; added: number; removed: number; changed: number } {
  const r = spawnSync('git', ['diff', '--no-index', '--numstat', path.join(seed, 'src'), path.join(tree, 'src')], { encoding: 'utf8' });
  let files = 0, added = 0, removed = 0;
  for (const l of (r.stdout ?? '').trim().split('\n').filter(Boolean)) {
    const [a, d] = l.split('\t');
    files += 1;
    added += Number(a);
    removed += Number(d);
  }
  return { files, added, removed, changed: added + removed };
}

function treeHash(dir: string): string {
  const h = createHash('sha256');
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else h.update(`${path.relative(dir, p)}\0`).update(fs.readFileSync(p)).update('\0');
    }
  };
  walk(dir);
  return h.digest('hex');
}

type Finding = { ruleId: string; file: string; target: string | null; checkCorrect: string };
const key = (f: Finding): string => `${f.ruleId}|${f.file}|${f.target ?? ''}`;
type SubGoal = { id: string; pass: boolean; evidence: string[] };

function main(): number {
  const puzzles = fs.readdirSync(path.join(REPO, ROOT, 'puzzles')).sort();
  const records: Json[] = [];
  for (const id of puzzles) {
    const dir = `${ROOT}/puzzles/${id}`;
    const meta = JSON.parse(fs.readFileSync(path.join(REPO, dir, 'puzzle.json'), 'utf8')) as Meta;
    const solutions = fs.readdirSync(path.join(REPO, dir, 'solutions')).sort();
    const gaming = meta.gaming ?? [];
    const alternatives = meta.alternatives ?? [];
    const trees = ['seed', ...solutions.map((s) => `solutions/${s}`), ...gaming.map((g) => g.tree), ...alternatives.map((a) => a.tree)];
    const perTree: Record<string, Json> = {};
    for (const t of trees) {
      const abs = path.join(REPO, dir, t);
      const tests = tsx([`${P01}/tools/run-tests.ts`, '--puzzle', dir, '--tree', `${dir}/${t}`]);
      const oracle = tsx([`${dir}/oracle.ts`, `${dir}/${t}`]);
      const previous = meta.previousOracle === undefined ? null : tsx([meta.previousOracle, `${dir}/${t}`]);
      const instrument = tsx([`${P01}/tools/instrument-score.ts`, '--spec', `${dir}/${meta.spec}`, '--tree', `${dir}/${t}`, '--label', `${id}/${t}`]);
      const detect = tsxWhole(['experiments/detect-02/mcp/push-gate.ts', '--project', `${dir}/${t}`, '--spec', `${dir}/${meta.spec}`, '--json']);
      const cases = (tests.out?.cases ?? []) as { name: string; kind: string; ok: boolean; error?: string }[];
      const blocking = ((instrument.out?.blocking ?? []) as Finding[]);
      perTree[t] = {
        sha256: treeHash(abs),
        tsc: typecheck(abs),
        tests: {
          regression: { passed: cases.filter((c) => c.kind === 'regression' && c.ok).length, total: cases.filter((c) => c.kind === 'regression').length },
          feature: { passed: cases.filter((c) => c.kind === 'feature' && c.ok).length, total: cases.filter((c) => c.kind === 'feature').length },
          failures: cases.filter((c) => !c.ok).map((c) => `${c.name}: ${(c.error ?? '').split('\n')[0] ?? ''}`),
        },
        oracle: { pass: oracle.out?.pass ?? null, subGoals: oracle.out?.subGoals ?? null, ...(oracle.out === null ? { error: oracle.err } : {}) },
        ...(previous === null ? {} : { previousOracle: { path: meta.previousOracle, pass: previous.out?.pass ?? null, subGoals: ((previous.out?.subGoals ?? []) as SubGoal[]).map((g) => ({ id: g.id, pass: g.pass })) } }),
        instrument: instrument.out?.ok === true
          ? { verdict: instrument.out.verdict, blockingByRule: instrument.out.blockingByRule, advisoryByRule: instrument.out.advisoryByRule, blocking: blocking.map((b) => ({ ruleId: b.ruleId, file: b.file, target: b.target, checkCorrect: b.checkCorrect })) }
          : { error: instrument.out?.errors ?? instrument.err },
        detect02: detect.out === null
          ? { error: detect.err }
          : { status: detect.out.status, rootsFrom: detect.out.rootsFrom, aggregateRoots: detect.out.aggregateRoots, findings: ((detect.out.findings ?? []) as { file: string; line: number; rule: string }[]).map((f) => `${f.rule} ${f.file}:${String(f.line)}`) },
        ...(t === 'seed' ? {} : { sizeVsSeed: size(path.join(REPO, dir, 'seed'), abs) }),
      };
    }
    // Hint audit of the task texts with the puzzle's spec.
    const ha = spawnSync('node', ['Docs/v1.3/study2-task-design/hint-audit.mjs', '--preset', `${dir}/${meta.spec}`, `${dir}/tasks.json`], { cwd: REPO, encoding: 'utf8' });
    const warns = (ha.stdout ?? '').split('\n').filter((l) => /^\s+WARN\s/.test(l)).map((l) => l.trim().replace(/\s+/g, ' '));
    const hintAudit = { exit: ha.status, fail: (ha.stdout ?? '').match(/total: (\d+) FAIL/)?.[1] ?? null, warns };

    // Properties.
    type T = { tsc: { errors: number }; tests: { regression: { passed: number; total: number }; feature: { passed: number; total: number } }; oracle: { pass: boolean | null; subGoals: SubGoal[] | null }; instrument: { blocking?: Finding[] }; sizeVsSeed: { changed: number; files: number } };
    const get = (t: string): T => perTree[t] as unknown as T;
    const seed = get('seed');
    const clean = get('solutions/clean');
    const traps = solutions.filter((s) => s.startsWith('trap')).map((s) => ({ name: s, t: get(`solutions/${s}`) }));
    const allPass = (x: T): boolean => x.tests.regression.passed === x.tests.regression.total && x.tests.feature.passed === x.tests.feature.total;
    const checks: Record<string, boolean> = {
      tscSeed: seed.tsc.errors === 0,
      tscSolutions: [clean, ...traps.map((x) => x.t)].every((x) => x.tsc.errors === 0),
      seedRegressionPass: seed.tests.regression.passed === seed.tests.regression.total,
      seedFeaturesFail: seed.tests.feature.passed === 0,
      seedOraclePass: seed.oracle.pass === true,
      winningLine_cleanTestsPass: allPass(clean),
      winningLine_cleanOraclePass: clean.oracle.pass === true,
      indistinguishable_trapTestsPass: traps.every((x) => allPass(x.t)),
      trap_oracleFailsEverySubGoal: traps.length > 0 && traps.every((x) => (x.t.oracle.subGoals ?? []).every((g) => !g.pass)),
      trap_shorterThanClean: traps.every((x) => x.t.sizeVsSeed.changed < clean.sizeVsSeed.changed),
      hintAudit_noFail: hintAudit.fail === '0',
      gaming_present: gaming.length > 0,
      gaming_tscAndTestsPass: gaming.every((g) => get(g.tree).tsc.errors === 0 && allPass(get(g.tree))),
      gaming_oracleFailsDeclaredSubGoals: gaming.every((g) => g.subGoals.every((s) => (get(g.tree).oracle.subGoals ?? []).find((x) => x.id === s)?.pass === false)),
      alternatives_testsAndOraclePass: alternatives.every((a) => get(a.tree).tsc.errors === 0 && allPass(get(a.tree)) && get(a.tree).oracle.pass === true),
    };
    // Instrument visibility: new correct blocking findings on a trap (vs the seed) that the clean tree lacks.
    const correctKeys = (x: T): Set<string> => new Set((x.instrument.blocking ?? []).filter((b) => b.checkCorrect === 'correct').map(key));
    const seedKeys = correctKeys(seed);
    const cleanNew = [...correctKeys(clean)].filter((k) => !seedKeys.has(k));
    const visibility = [...traps, ...gaming.map((g) => ({ name: g.tree, t: get(g.tree) }))].map((x) => {
      const trapNew = [...correctKeys(x.t)].filter((k) => !seedKeys.has(k) && !cleanNew.includes(k));
      const perSubGoal = (x.t.oracle.subGoals ?? []).map((g) => {
        const files = new Set(g.evidence.map((e) => e.split(/[:\s]/)[0]));
        const hits = trapNew.filter((k) => files.has(k.split('|')[1]));
        return { id: g.id, family: meta.subGoals.find((s) => s.id === g.id)?.family ?? '?', oracleFails: !g.pass, instrumentNewFindingsInEvidenceFiles: hits, findingInEvidenceFile: hits.length > 0, handReading: HAND_READING[`${id}/${x.name}/${g.id}`] ?? 'not read' };
      });
      return { tree: x.name, newCorrectBlocking: trapNew, cleanNewCorrectBlocking: cleanNew, perSubGoal };
    });
    const valid = Object.values(checks).every(Boolean);
    records.push({ id, verdict: valid ? 'VALID' : 'INVALID', checks, visibility, hintAudit, trees: perTree });
    process.stdout.write(`${id}: ${valid ? 'VALID' : 'INVALID'} ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}\n`);
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  const doc = {
    schema: 'puzzle-03-verification/v1',
    split: 'dev',
    calls: { model: 0, generator: 0, network: 0 },
    instrument: { path: `${P01}/tools/instrument-score.ts`, engine: 'cypher-interp', scoringMode: 'v1.3', codeAt: head, note: 'the instrument is the code at this commit; puzzle files are not part of it' },
    detect02: { path: 'experiments/detect-02/mcp/push-gate.ts', note: 'exploratory check_consistency (R-D4, R-XCTX), symbolic, zero calls; not the frozen instrument' },
    tsconfig: 'harness shape (strict, ES2022, commonjs, node resolution, types [node])',
    revisions: REVISIONS,
    puzzles: records,
  };
  fs.writeFileSync(path.join(REPO, OUT), `${JSON.stringify(doc, null, 1)}\n`);
  return records.every((r) => r.verdict === 'VALID') ? 0 : 1;
}

process.exitCode = main();
