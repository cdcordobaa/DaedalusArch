/**
 * N38 re-check (Docs/DiagnosticRuns/v1.3-extractor-fixes-n33-n38-2026-10-18.md). DEVELOPMENT DATA ONLY.
 *
 * The DDH base of the operator run is not available offline (it needs a clone and `npm install`), and the runner
 * evaluates against Neo4j. This script reuses the runner's own pieces on the strict reference hexagonal base
 * (`tests/fixtures/v1.3-reference`, `strict: true`): every eligible MO-H06 site is applied twice, once in the
 * catalogued form and once forced to the `optional` form (`x?: T`, the form of all ten DDH misses), type-checked with
 * the repository tsc, and evaluated with `bin/firewall.ts evaluate --symbolic-only --engine cypher-interp` (in process,
 * no Neo4j, no model call). A row is detected when every expected key (FF-P06 + FF-S01 + FF-S04) is matched by a new
 * violation, as in the runner.
 *
 * Usage (repository root): npx tsx scripts/v1.3/extractor-fixes-n38-check.ts --work <dir> [--out <file.json>]
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { violationsFromOutput, CLI_ENTRY } from '../lib/freeze-gate-main.js';
import { loadCompiledSpec } from '../lib/mutation/expected.js';
import { MO_H06 } from '../lib/mutation/hexddd/hexagonal.js';
import { openImportGraphProject } from '../lib/mutation/import-graph.js';
import { mulberry32 } from '../lib/mutation/rng.js';
import { evaluatePreconditions, sortSites } from '../lib/mutation/sites.js';
import type { MutationSite } from '../lib/mutation/types.js';
import { materialiseVariant } from './lib/materialise.js';
import { expectedKeys, matchesKey, newViolations } from './lib/operators-hexddd.js';
import type { Violation } from './lib/operators-hexddd.js';
import { loadReference } from './lib/reference-model.js';
import { contextOf, copyProject, templateIds, typecheck } from './operators-hexddd-run.js';
import type { Base } from './operators-hexddd-run.js';

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function evaluate(repoRoot: string, projectDir: string, specPath: string): Violation[] {
  const tsx = path.join(repoRoot, 'node_modules/.bin/tsx');
  const r = spawnSync(tsx, [CLI_ENTRY, 'evaluate', '--project', projectDir, '--spec', specPath, '--format', 'json', '--symbolic-only', '--engine', 'cypher-interp'], {
    cwd: repoRoot, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
  });
  const v = violationsFromOutput(r.stdout);
  if (!v.success) throw new Error(`evaluate ${projectDir}: ${v.errors.map((e) => e.message).join('; ')} ${r.stderr.slice(-500)}`);
  return [...v.data.violations];
}

async function main(argv: readonly string[], repoRoot: string): Promise<number> {
  const work = path.resolve(arg(argv, '--work') ?? '.n38-check-work');
  const outFile = arg(argv, '--out');
  const ref = loadReference(repoRoot, 'hexagonal');
  const clean = ref.variants.find((v) => v.manifest.kind === 'clean');
  if (clean === undefined) throw new Error('no clean hexagonal variant');
  const m = materialiseVariant(ref, clean, path.join(work, 'materialised'));
  const tsc = path.resolve(repoRoot, 'node_modules/typescript/lib/tsc.js');
  const base: Base = { baseId: 'ref-hexagonal', kind: 'reference', style: 'hexagonal', dir: m.projectDir, specPath: path.relative(repoRoot, ref.specPath), tsc };
  const specAbs = path.resolve(repoRoot, base.specPath);
  const baseCopy = path.join(work, 'base');
  copyProject(base.dir, baseCopy);
  const strict = (JSON.parse(fs.readFileSync(path.join(baseCopy, 'tsconfig.json'), 'utf8')) as { compilerOptions?: { strict?: boolean; strictNullChecks?: boolean } }).compilerOptions;
  const baseErrors = typecheck(tsc, baseCopy);
  if (baseErrors.length > 0) throw new Error(`base type errors: ${baseErrors[0] ?? ''}`);
  const compiled = await loadCompiledSpec(repoRoot, base.specPath);
  if (!compiled.success) throw new Error(compiled.errors.map((e) => e.message).join('; '));
  const ids = templateIds(compiled.data);
  const baseline = evaluate(repoRoot, baseCopy, specAbs);
  const handle = openImportGraphProject(baseCopy, 'tsconfig.json');
  const ctx = await contextOf(compiled.data, base, handle);
  const eligible = evaluatePreconditions(MO_H06, handle, compiled.data.spec, sortSites(MO_H06.findSites(handle, compiled.data.spec)), ctx).eligible;

  const rows: Record<string, unknown>[] = [];
  let n = 0;
  for (const { site } of eligible) {
    for (const form of ['catalogued', 'optional'] as const) {
      const s: MutationSite = form === 'optional' ? { ...site, detail: { ...site.detail, form: 'optional' } } : site;
      const dest = path.join(work, 'copies', `${String(n)}-${form}`);
      copyProject(base.dir, dest);
      const h = openImportGraphProject(dest, 'tsconfig.json');
      const r = MO_H06.apply(h, s, mulberry32(20261016));
      if (!r.success) { rows.push({ site: s, form, status: 'apply-error' }); continue; }
      await h.project.save();
      const errors = typecheck(tsc, dest);
      if (errors.length > 0) { rows.push({ site: s, form, status: 'typecheck', errors: errors.slice(0, 3) }); fs.rmSync(dest, { recursive: true, force: true }); continue; }
      const { keys } = expectedKeys(MO_H06, s, r.data, ids);
      const fresh = newViolations(baseline, evaluate(repoRoot, dest, specAbs));
      const hits = keys.map((k) => fresh.some((v) => matchesKey(v, k)));
      rows.push({
        filePath: s.filePath, class: s.detail.class, target: s.detail.targetName, form: s.detail.form,
        status: keys.length > 0 && hits.every(Boolean) ? 'detected' : 'missed',
        keys: keys.map((k, i) => `${k.functionId}:${hits[i] === true ? 'hit' : 'miss'}`),
      });
      fs.rmSync(dest, { recursive: true, force: true });
    }
    n++;
  }
  const tally = (form: string): string => {
    const rs = rows.filter((r) => r['form'] === form || (form === 'default-new' && r['form'] === undefined));
    return `${String(rs.filter((r) => r['status'] === 'detected').length)}/${String(rs.length)}`;
  };
  const summary = { base: base.baseId, compilerOptions: strict, eligibleSites: eligible.length, detectedDefaultNew: tally('default-new'), detectedOptional: tally('optional'), baselineViolations: baseline.length };
  process.stdout.write(`${JSON.stringify(summary, null, 1)}\n`);
  for (const r of rows) process.stdout.write(`${JSON.stringify(r)}\n`);
  if (outFile !== undefined) fs.writeFileSync(outFile, `${JSON.stringify({ summary, rows }, null, 1)}\n`);
  return 0;
}

void main(process.argv.slice(2), process.cwd()).then(
  (c) => { process.exitCode = c; },
  (e: unknown) => { process.stderr.write(`${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`); process.exitCode = 2; },
);
