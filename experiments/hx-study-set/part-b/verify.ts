/**
 * HX study set part B verification (zero calls). The TRAP-PILOT-v2 verify.ts checks, applied to the four part-B
 * tasks (`hxb*`), plus two test-surface checks that answer the pilot's facade defect. For every task, on the three
 * trees (seed, solutions/clean, solutions/trap):
 *   - type check (strict, ES2022, CommonJS, node resolution, types [node]; the pilot / PUZZLE-03 options);
 *   - behaviour tests (experiments/puzzle-01/tools/run-tests.ts): the seed fails (every regression case passes, every
 *     feature case fails), clean and trap pass every case;
 *   - oracle (`oracle.ts`, rule-blind): the seed and the clean tree pass, the trap tree fails;
 *   - change size against the seed (files and changed lines, `diff -r`);
 *   - hint audit of tasks.json (Docs/v1.3/study2-task-design/hint-audit.mjs with the task's spec.yaml and the extra
 *     FAIL terms below, a superset of the pilot's leak / mirror / shortcut): 0 FAIL;
 *   - entry points: every step text names the createApp() method that puzzle.json `entryPoints` lists for it, and
 *     every method the tests call on the app is named in some step text or already exists on the seed's app;
 *   - no strict deep equality in the tests (`deepEqual` / `deepStrictEqual`): answers are checked field by field.
 *
 *   npx tsx experiments/hx-study-set/part-b/verify.ts [--json out.json] [task-id …]
 * Exit 0 iff every invariant holds on every task checked.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../../..');
const argv = process.argv.slice(2);
const opt = (k: string): string | undefined => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const only = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1]!.startsWith('--')));
const TSX = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
export const AUDIT_TERMS = ['leak', 'mirror', 'shortcut', 'one to one', 'one-to-one', 'copy', 'rename', 'renamed', 'value set', 'vendor', 'transport', 'status code', 'http', 'header bag'];

const tsc = (tree: string): number => {
  const files: string[] = [];
  const walk = (d: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.ts')) files.push(p); } };
  walk(path.join(tree, 'src'));
  const program = ts.createProgram(files, { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10, noEmit: true, skipLibCheck: true, types: ['node'], typeRoots: [path.join(REPO, 'node_modules', '@types')] });
  const diags = ts.getPreEmitDiagnostics(program);
  for (const d of diags.slice(0, 5)) process.stderr.write(`  tsc ${path.relative(REPO, d.file?.fileName ?? '?')}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}\n`);
  return diags.length;
};
const run = (args: string[]): { code: number; out: string; err: string } => {
  const r = spawnSync(process.execPath, [TSX, ...args], { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  return { code: r.status ?? 2, out: r.stdout, err: r.stderr };
};
interface Tests { passed: number; failed: number; cases: { name: string; kind: string; ok: boolean; error?: string }[] }
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
  const out = spawnSync('diff', ['-r', '-N', seed, tree], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).stdout;
  return { files: (out.match(/^diff -r -N /gm) ?? []).length, lines: (out.match(/^[<>] /gm) ?? []).length + (out.match(/^[<>]$/gm) ?? []).length };
};
const audit = (task: string): { fail: number; warn: number; warnTerms: string[] } => {
  const args = [path.join(REPO, 'Docs/v1.3/study2-task-design/hint-audit.mjs'), '--preset', path.join(task, 'spec.yaml'), ...AUDIT_TERMS.flatMap((t) => ['--term', t]), '--json', path.join(task, 'tasks.json')];
  const r = spawnSync(process.execPath, args, { cwd: REPO, encoding: 'utf8' });
  const j = JSON.parse(r.stdout) as { totalFail: number; report: { hits: { level: string; term: string }[] }[] };
  const hits = j.report.flatMap((x) => x.hits);
  return { fail: j.totalFail, warn: hits.filter((h) => h.level === 'WARN').length, warnTerms: [...new Set(hits.filter((h) => h.level === 'WARN').map((h) => h.term.toLowerCase()))] };
};
/** Step texts name their entry points; every app method the tests call is named in a step or exists on the seed app. */
const entryPoints = (task: string): { ok: boolean; missing: string[] } => {
  const dir = path.join(REPO, task);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'puzzle.json'), 'utf8')) as { entryPoints: Record<string, string> };
  const steps = (JSON.parse(fs.readFileSync(path.join(dir, 'tasks.json'), 'utf8')) as { tasks: { steps: { id: string; request: string }[] }[] }).tasks[0]!.steps;
  const missing: string[] = [];
  for (const s of steps) {
    const ep = meta.entryPoints[s.id];
    if (ep === undefined || !s.request.includes(ep)) missing.push(`${s.id}: step text does not name ${ep ?? '(no entry point listed)'}`);
  }
  const testSrc = fs.readFileSync(path.join(dir, 'tests', 'behaviour.ts'), 'utf8');
  const seedApp = fs.readFileSync(path.join(dir, 'seed', 'src', 'config', 'container.ts'), 'utf8');
  const called = [...new Set([...testSrc.matchAll(/\bapp\.(\w+)/g)].map((m) => m[1]!))];
  const all = steps.map((s) => s.request).join('\n');
  for (const m of called) if (!new RegExp(`\\b${m}\\s*:`).test(seedApp) && !all.includes(`${m}(`)) missing.push(`tests call app.${m}, which neither the seed app has nor a step names`);
  return { ok: missing.length === 0, missing };
};
const deepEqualUses = (task: string): number => (fs.readFileSync(path.join(REPO, task, 'tests', 'behaviour.ts'), 'utf8').match(/\bdeep(Strict)?Equal\s*\(/g) ?? []).length;

const rows: Record<string, unknown>[] = [];
let allOk = true;
const ids = fs.readdirSync(HERE, { withFileTypes: true }).filter((e) => e.isDirectory() && /^hxb\d-/.test(e.name)).map((e) => e.name).sort();
for (const id of ids) {
  if (only.length > 0 && !only.some((o) => id.startsWith(o))) continue;
  const tr = path.relative(REPO, path.join(HERE, id));
  const trees = { seed: path.join(tr, 'seed'), clean: path.join(tr, 'solutions', 'clean'), trap: path.join(tr, 'solutions', 'trap') };
  const meta = JSON.parse(fs.readFileSync(path.join(HERE, id, 'puzzle.json'), 'utf8')) as { studySet: { shape: string; levers: string[] } };
  const t = { seed: tests(tr, trees.seed), clean: tests(tr, trees.clean), trap: tests(tr, trees.trap) };
  const o = { seed: oracle(tr, trees.seed), clean: oracle(tr, trees.clean), trap: oracle(tr, trees.trap) };
  const c = { seed: tsc(path.join(REPO, trees.seed)), clean: tsc(path.join(REPO, trees.clean)), trap: tsc(path.join(REPO, trees.trap)) };
  const size = { clean: change(path.join(REPO, trees.seed), path.join(REPO, trees.clean)), trap: change(path.join(REPO, trees.seed), path.join(REPO, trees.trap)) };
  const h = audit(tr);
  const ep = entryPoints(tr);
  const de = deepEqualUses(tr);
  const count = (x: Tests, kind: string): string => `${String(x.cases.filter((k) => k.kind === kind && k.ok).length)}/${String(x.cases.filter((k) => k.kind === kind).length)}`;
  const checks = {
    seedFailsEveryFeatureCase: t.seed.cases.filter((k) => k.kind === 'regression').every((k) => k.ok) && t.seed.cases.filter((k) => k.kind === 'feature').every((k) => !k.ok),
    cleanPassesTests: t.clean.failed === 0,
    trapPassesTests: t.trap.failed === 0,
    seedPassesOracle: o.seed.pass,
    cleanPassesOracle: o.clean.pass,
    trapFailsOracle: !o.trap.pass,
    typeChecks: c.seed === 0 && c.clean === 0 && c.trap === 0,
    hintAudit0Fail: h.fail === 0,
    entryPointsNamed: ep.ok,
    noStrictDeepEqual: de === 0,
  };
  const ok = Object.values(checks).every(Boolean);
  allOk &&= ok;
  for (const [name, x] of Object.entries(t)) for (const k of x.cases) if (!k.ok && name !== 'seed') process.stderr.write(`  ${id} ${name}: ${k.name}: ${k.error ?? ''}\n`);
  for (const k of t.seed.cases) if (k.kind === 'feature') process.stderr.write(`  ${id} seed feature '${k.name}': ${k.ok ? 'PASSES (should fail)' : `fails: ${(k.error ?? '').slice(0, 120)}`}\n`);
  if (!o.clean.pass) process.stderr.write(`  ${id} clean oracle: ${o.clean.items.join(' | ')}\n`);
  if (!o.seed.pass) process.stderr.write(`  ${id} seed oracle: ${o.seed.items.join(' | ')}\n`);
  for (const m of ep.missing) process.stderr.write(`  ${id} entry point: ${m}\n`);
  rows.push({ task: id, shape: meta.studySet.shape, levers: meta.studySet.levers, ok, checks, tests: { seed: [count(t.seed, 'regression'), count(t.seed, 'feature')], clean: [count(t.clean, 'regression'), count(t.clean, 'feature')], trap: [count(t.trap, 'regression'), count(t.trap, 'feature')] }, oracle: { seed: o.seed.pass, clean: o.clean.pass, trap: o.trap.pass, trapItems: o.trap.items.length, trapEvidence: o.trap.items }, tsc: c, size, hintAudit: h, entryPoints: ep, deepEqualUses: de });
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${id} [${meta.studySet.levers.join('')}] tests seed ${count(t.seed, 'regression')},${count(t.seed, 'feature')} clean ${count(t.clean, 'regression')},${count(t.clean, 'feature')} trap ${count(t.trap, 'regression')},${count(t.trap, 'feature')}; oracle seed ${o.seed.pass ? 'pass' : 'fail'} clean ${o.clean.pass ? 'pass' : 'fail'} trap ${o.trap.pass ? 'pass' : `fail (${String(o.trap.items.length)})`}; tsc ${c.seed}/${c.clean}/${c.trap}; size clean ${size.clean.files}f/${size.clean.lines}l trap ${size.trap.files}f/${size.trap.lines}l; audit ${h.fail} FAIL ${h.warn} WARN [${h.warnTerms.join(', ')}]; entry points ${ep.ok ? 'named' : 'MISSING'}; deepEqual ${de}\n`);
}
const jsonOut = opt('--json');
if (jsonOut !== undefined) fs.writeFileSync(jsonOut, `${JSON.stringify({ date: new Date().toISOString().slice(0, 10), allOk, auditTerms: AUDIT_TERMS, rows }, null, 1)}\n`);
process.exitCode = allOk ? 0 : 1;
