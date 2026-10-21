/**
 * PUZZLE-01 mechanical verification (zero calls: no model, no network, no Neo4j). Design note
 * `ops/notes/puzzle-01-design.md` §7.
 *
 * For every puzzle under `experiments/puzzle-01/puzzles/`: tsc (harness tsconfig shape, strict) on the seed and every
 * solution; the behaviour tests on every tree; the puzzle's oracle on every tree; the change size of every solution
 * against the seed; the DaedalusArch instrument (`instrument-score.ts`) on every tree; the hint audit of `tasks.json`
 * with the puzzle's spec. Then the three properties of §1 and a VALID / INVALID verdict per puzzle.
 *
 * Usage (repository root): npx tsx experiments/puzzle-01/tools/verify.ts [--out experiments/puzzle-01/verification.json]
 */
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

const REPO = process.cwd();
const ROOT = 'experiments/puzzle-01';
const outArg = process.argv.indexOf('--out');
const OUT = outArg >= 0 ? process.argv[outArg + 1]! : `${ROOT}/verification.json`;

/** Revisions made while building, logged instead of fixed silently (design note §2 R8). */
const REVISIONS = [
  { puzzle: 'p1-transfers', when: 'build, before the first verification run', what: 'feature test "a transfer between currencies or to an unknown account is refused" passed on the seed (assert.throws accepted the TypeError of a missing transfer); added an explicit check that transfer exists' },
  { puzzle: 'p4-library-holds', when: 'build, before the first verification run', what: 'step loan-list asked for "overdue first, then by due day", which is the same order as by due day in every reachable state, and its test used a run day on which the loan was not yet overdue; the step now asks for earliest due first and the test was corrected; the guard test on staff suspensions was re-labelled regression (it passes on the seed by design)' },
  { puzzle: 'p3-shipping-quotes', when: 'first verification run', what: 'not a fix: the design note expected partial instrument visibility; the run shows none (vendor imports are checked only in the domain layer). Recorded as measured; the puzzle is unchanged' },
];

/**
 * Hand reading of the instrument's view per sub-goal (coordinator, after the mechanical run): the mechanical column
 * only says whether a new finding sits in a file the oracle cites, which can be a coincidence of place.
 */
const HAND_READING: Record<string, string> = {
  'p1-transfers/trap/SG1': 'invisible: no finding (no rule for two aggregates in one command, D4 class iv)',
  'p1-transfers/trap/SG2': 'invisible: no finding (rule placement, D5 class iii/iv)',
  'p2-loyalty/trap/SG1': 'visible: the two new FF-DS02 findings are exactly the imports of membership internals',
  'p2-loyalty/trap/SG2': 'co-located only: the FF-DS02 findings are the imports SG1 uses; the second write (D4) has no finding of its own',
  'p2-loyalty/trap-alt/SG1': 'invisible: duplicated thresholds (D10) raise nothing',
  'p2-loyalty/trap-alt/SG2': 'invisible: the write goes through the published interface; no finding',
  'p3-shipping-quotes/trap/SG1': 'invisible: vendor types in an application port raise nothing (H5 class iv)',
  'p3-shipping-quotes/trap/SG2': 'invisible: FF-P01 checks the vendor package in the domain layer only; an application-layer runtime import raises nothing',
  'p4-library-holds/trap/SG1': 'visible: one new correct FF-S01 finding on the upward import',
};

interface Json { [k: string]: unknown }
const tsx = (args: string[]): { code: number; out: Json | null; err: string } => {
  const r = spawnSync('npx', ['tsx', ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const line = (r.stdout ?? '').trim().split('\n').filter((l) => l.startsWith('{')).at(-1);
  return { code: r.status ?? -1, out: line === undefined ? null : (JSON.parse(line) as Json), err: (r.stderr ?? '').slice(0, 2000) };
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

function main(): number {
  const puzzles = fs.readdirSync(path.join(REPO, ROOT, 'puzzles')).sort();
  const records: Json[] = [];
  for (const id of puzzles) {
    const dir = `${ROOT}/puzzles/${id}`;
    const meta = JSON.parse(fs.readFileSync(path.join(REPO, dir, 'puzzle.json'), 'utf8')) as { subGoals: { id: string; family: string }[]; spec: string };
    const solutions = fs.readdirSync(path.join(REPO, dir, 'solutions')).sort();
    const trees = ['seed', ...solutions.map((s) => `solutions/${s}`)];
    const perTree: Record<string, Json> = {};
    for (const t of trees) {
      const abs = path.join(REPO, dir, t);
      const tests = tsx([`${ROOT}/tools/run-tests.ts`, '--puzzle', dir, '--tree', `${dir}/${t}`]);
      const oracle = tsx([`${dir}/oracle.ts`, `${dir}/${t}`]);
      const instrument = tsx([`${ROOT}/tools/instrument-score.ts`, '--spec', `${dir}/${meta.spec}`, '--tree', `${dir}/${t}`, '--label', `${id}/${t}`]);
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
        instrument: instrument.out?.ok === true
          ? { verdict: instrument.out.verdict, blockingByRule: instrument.out.blockingByRule, advisoryByRule: instrument.out.advisoryByRule, blocking: blocking.map((b) => ({ ruleId: b.ruleId, file: b.file, target: b.target, checkCorrect: b.checkCorrect })) }
          : { error: instrument.out?.errors ?? instrument.err },
        ...(t === 'seed' ? {} : { sizeVsSeed: size(path.join(REPO, dir, 'seed'), abs) }),
      };
    }
    // Hint audit of the task texts with the puzzle's spec.
    const ha = spawnSync('node', ['Docs/v1.3/study2-task-design/hint-audit.mjs', '--preset', `${dir}/${meta.spec}`, `${dir}/tasks.json`], { cwd: REPO, encoding: 'utf8' });
    const warns = (ha.stdout ?? '').split('\n').filter((l) => /^\s+WARN\s/.test(l)).map((l) => l.trim().replace(/\s+/g, ' '));
    const hintAudit = { exit: ha.status, fail: (ha.stdout ?? '').match(/total: (\d+) FAIL/)?.[1] ?? null, warns };

    // Properties.
    const seed = perTree.seed as { tsc: { errors: number }; tests: { regression: { passed: number; total: number }; feature: { passed: number; total: number } }; oracle: { pass: boolean | null }; instrument: { blocking?: Finding[] } };
    const clean = perTree['solutions/clean'] as typeof seed & { sizeVsSeed: { changed: number; files: number } };
    const traps = solutions.filter((s) => s.startsWith('trap')).map((s) => ({ name: s, t: perTree[`solutions/${s}`] as typeof clean & { oracle: { subGoals: { id: string; pass: boolean; evidence: string[] }[] } } }));
    const allPass = (x: typeof seed): boolean => x.tests.regression.passed === x.tests.regression.total && x.tests.feature.passed === x.tests.feature.total;
    const checks: Record<string, boolean> = {
      tscSeed: seed.tsc.errors === 0,
      tscSolutions: [clean, ...traps.map((x) => x.t)].every((x) => x.tsc.errors === 0),
      seedRegressionPass: seed.tests.regression.passed === seed.tests.regression.total,
      seedFeaturesFail: seed.tests.feature.passed === 0,
      seedOraclePass: seed.oracle.pass === true,
      winningLine_cleanTestsPass: allPass(clean),
      winningLine_cleanOraclePass: clean.oracle.pass === true,
      indistinguishable_trapTestsPass: traps.every((x) => allPass(x.t)),
      trap_oracleFailsEverySubGoal: traps.length > 0 && traps.every((x) => x.t.oracle.subGoals.every((g) => !g.pass)),
      trap_shorterThanClean: traps.every((x) => x.t.sizeVsSeed.changed < clean.sizeVsSeed.changed),
      hintAudit_noFail: hintAudit.fail === '0',
    };
    // Instrument visibility: new correct blocking findings on a trap (vs the seed) that the clean tree lacks.
    const correctKeys = (x: { instrument: { blocking?: Finding[] } }): Set<string> => new Set((x.instrument.blocking ?? []).filter((b) => b.checkCorrect === 'correct').map(key));
    const seedKeys = correctKeys(seed);
    const cleanNew = [...correctKeys(clean)].filter((k) => !seedKeys.has(k));
    const visibility = traps.map((x) => {
      const trapNew = [...correctKeys(x.t)].filter((k) => !seedKeys.has(k) && !cleanNew.includes(k));
      const perSubGoal = x.t.oracle.subGoals.map((g) => {
        const files = new Set(g.evidence.map((e) => e.split(/[:\s]/)[0]));
        const hits = trapNew.filter((k) => files.has(k.split('|')[1]));
        return { id: g.id, family: meta.subGoals.find((s) => s.id === g.id)?.family ?? '?', oracleFails: !g.pass, instrumentNewFindingsInEvidenceFiles: hits, findingInEvidenceFile: hits.length > 0, handReading: HAND_READING[`${id}/${x.name}/${g.id}`] ?? 'not read' };
      });
      return { trap: x.name, trapNewCorrectBlocking: trapNew, cleanNewCorrectBlocking: cleanNew, perSubGoal };
    });
    const valid = Object.values(checks).every(Boolean);
    records.push({ id, verdict: valid ? 'VALID' : 'INVALID', checks, visibility, hintAudit, trees: perTree });
    process.stdout.write(`${id}: ${valid ? 'VALID' : 'INVALID'} ${Object.entries(checks).filter(([, v]) => !v).map(([k]) => k).join(', ')}\n`);
  }
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  const doc = {
    schema: 'puzzle-01-verification/v1',
    split: 'dev',
    calls: { model: 0, generator: 0, network: 0 },
    instrument: { path: `${ROOT}/tools/instrument-score.ts`, engine: 'cypher-interp', scoringMode: 'v1.3', codeAt: head, note: 'the instrument is the code at this commit; puzzle files are not part of it' },
    tsconfig: 'harness shape (strict, ES2022, commonjs, node resolution, types [node])',
    revisions: REVISIONS,
    puzzles: records,
  };
  fs.writeFileSync(path.join(REPO, OUT), `${JSON.stringify(doc, null, 1)}\n`);
  return records.every((r) => r.verdict === 'VALID') ? 0 : 1;
}

process.exitCode = main();
