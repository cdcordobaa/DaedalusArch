/**
 * TRAP-PILOT-v2 verification (zero calls): for every variant `<id>/<L>/` checks, mechanically, on the three trees
 * (seed, solutions/clean, solutions/trap):
 *   - type check (strict, ES2022, CommonJS, node resolution, types [node]; the PUZZLE-03 verify.ts options);
 *   - behaviour tests (experiments/puzzle-01/tools/run-tests.ts): seed fails (regression cases pass, some feature
 *     case fails), clean and trap pass every case;
 *   - oracle (`oracle.ts`): clean passes, trap fails (the seed passes too: no planted debt);
 *   - the change size against the seed (files and changed lines, `diff -r`);
 *   - the hint audit of tasks.json (Docs/v1.3/study2-task-design/hint-audit.mjs with the variant's spec.yaml and the
 *     extra FAIL terms leak and mirror): 0 FAIL.
 *
 *   npx tsx experiments/trap-pilot-v2/verify.ts [--json out.json] [--md out.md] [task-id …]
 * Exit 0 iff every invariant holds on every variant checked.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const argv = process.argv.slice(2);
const opt = (k: string): string | undefined => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const only = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1]!.startsWith('--')));
const TSX = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const tsc = (tree: string): number => {
  const files: string[] = [];
  const walk = (d: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.ts')) files.push(p); } };
  walk(path.join(tree, 'src'));
  // The vendor stand-in is resolved through the typings (declare module), as in the trap-families verify step.
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
const tests = (variant: string, tree: string): Tests => {
  const r = run(['experiments/puzzle-01/tools/run-tests.ts', '--puzzle', variant, '--tree', tree]);
  try { return JSON.parse(r.out.trim().split('\n').pop()!) as Tests; } catch { throw new Error(`tests did not run on ${tree}: ${r.err.slice(0, 800)}`); }
};
const oracle = (variant: string, tree: string): { pass: boolean; evidence: number; items: string[] } => {
  const r = run([path.join(variant, 'oracle.ts'), tree]);
  try {
    const j = JSON.parse(r.out.trim().split('\n').pop()!) as { pass: boolean; subGoals: { evidence: string[] }[] };
    const items = j.subGoals.flatMap((s) => s.evidence);
    return { pass: j.pass, evidence: items.length, items };
  } catch { throw new Error(`oracle did not run on ${tree}: ${r.err.slice(0, 800)}`); }
};
const change = (seed: string, tree: string): { files: number; lines: number } => {
  const r = spawnSync('diff', ['-r', '-N', seed, tree], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const out = r.stdout;
  const files = (out.match(/^diff -r -N /gm) ?? []).length;
  const lines = (out.match(/^[<>] /gm) ?? []).length + (out.match(/^[<>]$/gm) ?? []).length;
  return { files, lines };
};
const audit = (variant: string): { fail: number; warn: number; warnTerms: string[] } => {
  const r = spawnSync(process.execPath, [path.join(REPO, 'Docs/v1.3/study2-task-design/hint-audit.mjs'), '--preset', path.join(variant, 'spec.yaml'), '--term', 'leak', '--term', 'mirror', '--term', 'shortcut', '--json', path.join(variant, 'tasks.json')], { cwd: REPO, encoding: 'utf8' });
  const j = JSON.parse(r.stdout) as { totalFail: number; report: { warn: number; hits: { level: string; term: string }[] }[] };
  const hits = j.report.flatMap((x) => x.hits);
  return { fail: j.totalFail, warn: hits.filter((h) => h.level === 'WARN').length, warnTerms: [...new Set(hits.filter((h) => h.level === 'WARN').map((h) => h.term.toLowerCase()))] };
};

const rows: Record<string, unknown>[] = [];
let allOk = true;
const tasks = fs.readdirSync(HERE, { withFileTypes: true }).filter((e) => e.isDirectory() && /^p\d-/.test(e.name)).map((e) => e.name).sort();
for (const task of tasks) {
  if (only.length > 0 && !only.some((o) => task.startsWith(o))) continue;
  for (const level of ['L1', 'L2', 'L3']) {
    const v = path.join(HERE, task, level);
    if (!fs.existsSync(v)) continue;
    const vr = path.relative(REPO, v);
    const trees = { seed: path.join(vr, 'seed'), clean: path.join(vr, 'solutions', 'clean'), trap: path.join(vr, 'solutions', 'trap') };
    const meta = JSON.parse(fs.readFileSync(path.join(v, 'puzzle.json'), 'utf8')) as { pilot: { levers: string[] } };
    const t = { seed: tests(vr, trees.seed), clean: tests(vr, trees.clean), trap: tests(vr, trees.trap) };
    const o = { seed: oracle(vr, trees.seed), clean: oracle(vr, trees.clean), trap: oracle(vr, trees.trap) };
    const c = { seed: tsc(path.join(REPO, trees.seed)), clean: tsc(path.join(REPO, trees.clean)), trap: tsc(path.join(REPO, trees.trap)) };
    const size = { clean: change(path.join(REPO, trees.seed), path.join(REPO, trees.clean)), trap: change(path.join(REPO, trees.seed), path.join(REPO, trees.trap)) };
    const h = audit(vr);
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
    };
    const ok = Object.values(checks).every(Boolean);
    allOk &&= ok;
    for (const [name, x] of Object.entries(t)) for (const k of x.cases) if (!k.ok && name !== 'seed') process.stderr.write(`  ${task}/${level} ${name}: ${k.name}: ${k.error ?? ''}\n`);
    if (!o.clean.pass) process.stderr.write(`  ${task}/${level} clean oracle: ${o.clean.items.join(' | ')}\n`);
    rows.push({ task, level, levers: meta.pilot.levers, ok, checks, tests: { seed: [reg(t.seed), feat(t.seed)], clean: [reg(t.clean), feat(t.clean)], trap: [reg(t.trap), feat(t.trap)] }, oracle: { seed: o.seed.pass, clean: o.clean.pass, trap: o.trap.pass, trapItems: o.trap.evidence, trapEvidence: o.trap.items }, tsc: c, size, hintAudit: h });
    process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${task}/${level} [${meta.pilot.levers.join('') || '-'}] tests seed ${reg(t.seed)},${feat(t.seed)} clean ${reg(t.clean)},${feat(t.clean)} trap ${reg(t.trap)},${feat(t.trap)}; oracle seed ${o.seed.pass ? 'pass' : 'fail'} clean ${o.clean.pass ? 'pass' : 'fail'} trap ${o.trap.pass ? 'pass' : `fail (${String(o.trap.evidence)})`}; tsc ${c.seed}/${c.clean}/${c.trap}; size clean ${size.clean.files}f/${size.clean.lines}l trap ${size.trap.files}f/${size.trap.lines}l; audit ${h.fail} FAIL ${h.warn} WARN\n`);
  }
}
const jsonOut = opt('--json');
if (jsonOut !== undefined) fs.writeFileSync(jsonOut, `${JSON.stringify({ date: new Date().toISOString().slice(0, 10), allOk, rows }, null, 1)}\n`);
const mdOut = opt('--md');
if (mdOut !== undefined) {
  const md = ['| Variant | Levers | Tests seed (reg, feat) | Tests clean | Tests trap | Oracle seed / clean / trap (items) | tsc seed/clean/trap | Change clean (files, lines) | Change trap (files, lines) | Hint audit | All invariants |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of rows as { task: string; level: string; levers: string[]; ok: boolean; tests: Record<string, string[]>; oracle: { seed: boolean; clean: boolean; trap: boolean; trapItems: number }; tsc: Record<string, number>; size: Record<string, { files: number; lines: number }>; hintAudit: { fail: number; warn: number } }[]) {
    md.push(`| \`${r.task}/${r.level}\` | ${r.levers.join(', ') || 'none'} | ${r.tests.seed!.join(', ')} | ${r.tests.clean!.join(', ')} | ${r.tests.trap!.join(', ')} | ${r.oracle.seed ? 'pass' : 'fail'} / ${r.oracle.clean ? 'pass' : 'fail'} / ${r.oracle.trap ? 'pass' : 'fail'} (${String(r.oracle.trapItems)}) | ${r.tsc.seed}/${r.tsc.clean}/${r.tsc.trap} | ${r.size.clean!.files}, ${r.size.clean!.lines} | ${r.size.trap!.files}, ${r.size.trap!.lines} | ${r.hintAudit.fail} FAIL, ${r.hintAudit.warn} WARN | ${r.ok ? 'yes' : 'NO'} |`);
  }
  fs.writeFileSync(mdOut, `${md.join('\n')}\n`);
}
process.exitCode = allOk ? 0 : 1;
