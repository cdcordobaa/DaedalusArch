/**
 * SEM-GATE-2 tree checks (zero model calls): every built tree of `cases.json` passes its task's behaviour tests
 * (`experiments/puzzle-01/tools/run-tests.ts`) and tsc (strict, the options of `experiments/hx-study-set/part-b/verify.ts`)
 * with 0 errors.
 *
 *   npx tsx experiments/sem-gate-2/check-trees.ts [--out experiments/sem-gate-2/results/tree-checks.json]
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';

const REPO = process.cwd();
const TSX = path.join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };

const tsc = (tree: string): { errors: number; first: string[] } => {
  const files: string[] = [];
  const walk = (d: string): void => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (e.name.endsWith('.ts')) files.push(p); } };
  walk(path.join(tree, 'src'));
  const program = ts.createProgram(files, { strict: true, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, moduleResolution: ts.ModuleResolutionKind.Node10, noEmit: true, skipLibCheck: true, types: ['node'], typeRoots: [path.join(REPO, 'node_modules', '@types')] });
  const diags = ts.getPreEmitDiagnostics(program);
  return { errors: diags.length, first: diags.slice(0, 3).map((d) => `${path.relative(tree, d.file?.fileName ?? '?')}: ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`) };
};

interface Case { id: string; source: string; tree: string; puzzle: string }
const man = JSON.parse(fs.readFileSync('experiments/sem-gate-2/cases.json', 'utf8')) as { cases: Case[] };
const rows: Record<string, unknown>[] = [];
for (const c of man.cases.filter((x) => x.source === 'built')) {
  const t = tsc(path.join(REPO, c.tree));
  const r = spawnSync(process.execPath, [TSX, 'experiments/puzzle-01/tools/run-tests.ts', '--puzzle', c.puzzle, '--tree', c.tree], { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  let passed = 0; let failed = -1; let failures: string[] = [];
  try { const j = JSON.parse(r.stdout) as { passed: number; failed: number; cases: { name: string; ok: boolean; error?: string }[] }; passed = j.passed; failed = j.failed; failures = j.cases.filter((x) => !x.ok).map((x) => `${x.name}: ${x.error ?? ''}`.slice(0, 200)); } catch { failures = [r.stderr.slice(0, 300)]; }
  const ok = t.errors === 0 && failed === 0 && r.status === 0;
  rows.push({ id: c.id, tsc: t.errors, tests: `${String(passed)}/${String(passed + Math.max(failed, 0))}`, ok, ...(ok ? {} : { tscFirst: t.first, failures }) });
  process.stdout.write(`${ok ? 'ok  ' : 'FAIL'} ${c.id.padEnd(12)} tsc ${String(t.errors)} tests ${String(passed)}/${String(passed + Math.max(failed, 0))}${ok ? '' : ` ${JSON.stringify([...t.first, ...failures])}`}\n`);
}
const out = argOf('--out');
if (out !== undefined) fs.writeFileSync(out, `${JSON.stringify({ allOk: rows.every((r) => r['ok']), rows }, null, 1)}\n`);
