/**
 * HX study set part A verification (zero calls), the TRAP-PILOT-v2 verify.ts checks per task on the three trees
 * (seed, solutions/clean, solutions/trap), plus the entry-point and similarity checks:
 *   - type check (strict, ES2022, CommonJS, node resolution, types [node]);
 *   - behaviour tests (experiments/puzzle-01/tools/run-tests.ts): the seed fails (regression cases pass, some feature
 *     case fails), clean and trap pass every case;
 *   - oracle (`oracle.ts`): seed and clean pass, trap fails;
 *   - the change size against the seed (files and changed lines, `diff -r`);
 *   - the hint audit of tasks.json (Docs/v1.3/study2-task-design/hint-audit.mjs with the task's spec.yaml and the
 *     extra FAIL terms leak, mirror and shortcut): 0 FAIL;
 *   - entry points: every step text names an `app.<method>(` that the clean tree's createApp returns, and every
 *     method a step's feature tests call is on the seed's createApp already or named by a step;
 *   - similarity (./similarity.ts): every pair with another study task below 0.6 in both readings (the shape reading
 *     is the one that reproduces PR 398's figures).
 *
 *   npx tsx experiments/hx-study-set/part-a/verify.ts [--json out.json] [task-id …]
 * Exit 0 iff every invariant holds on every task checked.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { similarity } from './similarity';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const argv = process.argv.slice(2);
const opt = (k: string): string | undefined => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const only = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1]!.startsWith('--')));
// Resolved like any import, so a checkout whose node_modules sits in a parent folder works too.
const require = createRequire(import.meta.url);
const TSX = require.resolve('tsx/cli');
const TYPE_ROOTS = path.resolve(path.dirname(require.resolve('@types/node/package.json')), '..');
const SIM_MAX = 0.6;

const tsc = (tree: string): number => {
  const files: string[] = [];
  const walk = (d: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.ts')) files.push(p); } };
  walk(path.join(tree, 'src'));
  const program = ts.createProgram(files, { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10, noEmit: true, skipLibCheck: true, types: ['node'], typeRoots: [TYPE_ROOTS] });
  const diags = ts.getPreEmitDiagnostics(program);
  for (const d of diags.slice(0, 5)) process.stderr.write(`  tsc ${path.relative(REPO, d.file?.fileName ?? '?')}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}\n`);
  return diags.length;
};
const run = (args: string[]): { code: number; out: string; err: string } => {
  const r = spawnSync(process.execPath, [TSX, ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return { code: r.status ?? 2, out: r.stdout, err: r.stderr };
};
interface Tests { passed: number; failed: number; cases: { name: string; kind: string; step: string | null; ok: boolean; error?: string }[] }
const tests = (task: string, tree: string): Tests => {
  const r = run(['experiments/puzzle-01/tools/run-tests.ts', '--puzzle', task, '--tree', tree]);
  try { return JSON.parse(r.out.trim().split('\n').pop()!) as Tests; } catch { throw new Error(`tests did not run on ${tree}: ${r.err.slice(0, 800)}`); }
};
const oracle = (task: string, tree: string): { pass: boolean; items: string[] } => {
  const r = run([path.join(task, 'oracle.ts'), tree]);
  try {
    const j = JSON.parse(r.out.trim().split('\n').pop()!) as { pass: boolean; subGoals: { evidence: string[] }[] };
    return { pass: j.pass, items: j.subGoals.flatMap((s) => s.evidence) };
  } catch { throw new Error(`oracle did not run on ${tree}: ${r.err.slice(0, 800)}`); }
};
const change = (seed: string, tree: string): { files: number; lines: number } => {
  const r = spawnSync('diff', ['-r', '-N', seed, tree], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return { files: (r.stdout.match(/^diff -r -N /gm) ?? []).length, lines: (r.stdout.match(/^[<>] /gm) ?? []).length + (r.stdout.match(/^[<>]$/gm) ?? []).length };
};
const audit = (task: string): { fail: number; warn: number; failTerms: string[]; warnTerms: string[] } => {
  const r = spawnSync(process.execPath, [path.join(REPO, 'Docs/v1.3/study2-task-design/hint-audit.mjs'), '--preset', path.join(task, 'spec.yaml'), '--term', 'leak', '--term', 'mirror', '--term', 'shortcut', '--json', path.join(task, 'tasks.json')], { cwd: REPO, encoding: 'utf8' });
  const j = JSON.parse(r.stdout) as { totalFail: number; report: { hits: { level: string; term: string }[] }[] };
  const hits = j.report.flatMap((x) => x.hits);
  const terms = (lv: string): string[] => [...new Set(hits.filter((h) => h.level === lv).map((h) => h.term.toLowerCase()))];
  return { fail: j.totalFail, warn: hits.filter((h) => h.level === 'WARN').length, failTerms: terms('FAIL'), warnTerms: terms('WARN') };
};
/** Each step names app.<m>( ; m is a key of the clean createApp's returned object and the step's tests call app.<m>(. */
const entryPoints = (dir: string): { ok: boolean; byStep: Record<string, string[]>; problems: string[] } => {
  const steps = (JSON.parse(fs.readFileSync(path.join(dir, 'tasks.json'), 'utf8')) as { tasks: { steps: { id: string; request: string }[] }[] }).tasks[0]!.steps;
  const container = fs.readFileSync(path.join(dir, 'solutions/clean/src/config/container.ts'), 'utf8');
  const seedContainer = fs.readFileSync(path.join(dir, 'seed/src/config/container.ts'), 'utf8');
  const onSeed = (m: string): boolean => new RegExp(`^\\s+${m}: async`, 'm').test(seedContainer);
  const testText = fs.readFileSync(path.join(dir, 'tests/behaviour.ts'), 'utf8');
  const problems: string[] = [];
  const byStep: Record<string, string[]> = {};
  for (const s of steps) {
    const named = [...new Set([...s.request.matchAll(/\bapp\.(\w+)\(/g)].map((m) => m[1]!))];
    byStep[s.id] = named.map((m) => `app.${m}`);
    if (named.length === 0) problems.push(`${s.id}: names no app.<method>(`);
    for (const m of named) if (!new RegExp(`^\\s+${m}: async`, 'm').test(container)) problems.push(`${s.id}: app.${m} is not on the clean createApp`);
    // The step's feature cases: the text between "step: '<id>'" and the next case.
    const blocks = testText.split(/\n  \{\n/).filter((b) => b.includes(`step: '${s.id}'`));
    const called = new Set(blocks.flatMap((b) => [...b.matchAll(/\bapp\.(\w+)\(/g)].map((m) => m[1]!)));
    // A method the feature tests call must be on the seed's createApp already, or be named by a step.
    for (const m of called) if (!onSeed(m) && !steps.some((o) => o.request.includes(`app.${m}(`))) problems.push(`${s.id}: the tests call app.${m}, which is not on the seed and no step names`);
  }
  return { ok: problems.length === 0, byStep, problems };
};

const tasks = fs.readdirSync(HERE, { withFileTypes: true }).filter((e) => e.isDirectory() && /^hx[ab]\d-/.test(e.name)).map((e) => e.name).sort().filter((t) => only.length === 0 || only.some((o) => t.startsWith(o)));
const sim = similarity(tasks);
const rows: Record<string, unknown>[] = [];
let allOk = true;
for (const task of tasks) {
  const dir = path.join(HERE, task);
  const tr = path.relative(REPO, dir);
  const trees = { seed: path.join(tr, 'seed'), clean: path.join(tr, 'solutions', 'clean'), trap: path.join(tr, 'solutions', 'trap') };
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'puzzle.json'), 'utf8')) as { hxStudySet: { shape: string; levers: string[] } };
  const t = { seed: tests(tr, trees.seed), clean: tests(tr, trees.clean), trap: tests(tr, trees.trap) };
  const o = { seed: oracle(tr, trees.seed), clean: oracle(tr, trees.clean), trap: oracle(tr, trees.trap) };
  const c = { seed: tsc(path.join(REPO, trees.seed)), clean: tsc(path.join(REPO, trees.clean)), trap: tsc(path.join(REPO, trees.trap)) };
  const size = { clean: change(path.join(REPO, trees.seed), path.join(REPO, trees.clean)), trap: change(path.join(REPO, trees.seed), path.join(REPO, trees.trap)) };
  const h = audit(tr);
  const ep = entryPoints(dir);
  const mine = sim.pairs.filter((p) => (p.a === task || p.b === task) && p.group !== 'pilot-template');
  const maxOf = (k: 'words' | 'shape', ps: typeof mine): { value: number; with: string } => ps.reduce((x, p) => (p[k] > x.value ? { value: p[k], with: p.a === task ? p.b : p.a } : x), { value: 0, with: '' });
  const simWords = maxOf('words', mine);
  const simShape = maxOf('shape', mine);
  const tmpl = sim.pairs.filter((p) => p.a === task && p.group === 'pilot-template');
  const reg = (x: Tests): string => `${String(x.cases.filter((k) => k.kind === 'regression' && k.ok).length)}/${String(x.cases.filter((k) => k.kind === 'regression').length)}`;
  const feat = (x: Tests): string => `${String(x.cases.filter((k) => k.kind === 'feature' && k.ok).length)}/${String(x.cases.filter((k) => k.kind === 'feature').length)}`;
  const checks = {
    seedFailsTests: t.seed.failed > 0 && t.seed.cases.filter((k) => k.kind === 'regression').every((k) => k.ok),
    cleanPassesTests: t.clean.failed === 0,
    trapPassesTests: t.trap.failed === 0,
    seedPassesOracle: o.seed.pass,
    cleanPassesOracle: o.clean.pass,
    trapFailsOracle: !o.trap.pass,
    typeChecks: c.seed === 0 && c.clean === 0 && c.trap === 0,
    hintAudit0Fail: h.fail === 0,
    entryPointsNamed: ep.ok,
    similarityBelow06: simShape.value < SIM_MAX && simWords.value < SIM_MAX,
  };
  const ok = Object.values(checks).every(Boolean);
  allOk &&= ok;
  for (const [name, x] of Object.entries(t)) for (const k of x.cases) if (!k.ok && name !== 'seed') process.stderr.write(`  ${task} ${name}: ${k.name}: ${k.error ?? ''}\n`);
  if (!o.clean.pass) process.stderr.write(`  ${task} clean oracle: ${o.clean.items.join(' | ')}\n`);
  if (!o.seed.pass) process.stderr.write(`  ${task} seed oracle: ${o.seed.items.join(' | ')}\n`);
  for (const p of ep.problems) process.stderr.write(`  ${task} entry point: ${p}\n`);
  if (h.fail > 0) process.stderr.write(`  ${task} hint audit FAIL terms: ${h.failTerms.join(', ')}\n`);
  rows.push({ task, shape: meta.hxStudySet.shape, levers: meta.hxStudySet.levers, ok, checks, tests: { seed: [reg(t.seed), feat(t.seed)], clean: [reg(t.clean), feat(t.clean)], trap: [reg(t.trap), feat(t.trap)] }, oracle: { seed: o.seed.pass, clean: o.clean.pass, trap: o.trap.pass, trapItems: o.trap.items.length, trapEvidence: o.trap.items }, tsc: c, size, hintAudit: h, entryPoints: ep.byStep, similarity: { maxWords: simWords, maxShape: simShape, pilotTemplates: tmpl.map((p) => ({ with: p.b, words: p.words, shape: p.shape })) } });
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${task} tests seed ${reg(t.seed)},${feat(t.seed)} clean ${reg(t.clean)},${feat(t.clean)} trap ${reg(t.trap)},${feat(t.trap)}; oracle seed ${o.seed.pass ? 'pass' : 'fail'} clean ${o.clean.pass ? 'pass' : 'fail'} trap ${o.trap.pass ? 'pass' : `fail (${String(o.trap.items.length)})`}; tsc ${c.seed}/${c.clean}/${c.trap}; size clean ${size.clean.files}f/${size.clean.lines}l trap ${size.trap.files}f/${size.trap.lines}l; audit ${h.fail} FAIL ${h.warn} WARN [${h.warnTerms.join(',')}]; entry ${ep.ok ? 'ok' : 'NO'}; sim words ${simWords.value.toFixed(2)} (${simWords.with}) shape ${simShape.value.toFixed(2)} (${simShape.with})\n`);
}
const jsonOut = opt('--json');
if (jsonOut !== undefined) fs.writeFileSync(jsonOut, `${JSON.stringify({ date: new Date().toISOString().slice(0, 10), allOk, similarityCompared: sim.compared, rows }, null, 1)}\n`);
process.exitCode = allOk ? 0 : 1;
