/**
 * Metamorphic run over the v1.3 reference set (71 variants): applies each semantics-preserving transformation of
 * `scripts/v1.3/lib/metamorphic.ts` to every materialised variant, keeps the first candidate that type-checks, runs
 * `firewall evaluate --symbolic-only --format json --engine cypher-interp` on it, and compares the blocking findings
 * with the untransformed variant's (Docs/DiagnosticRuns/v1.3-metamorphic-2026-10-16.md).
 *
 * Usage (repository root; no Neo4j, no credentials):
 *   node --import tsx scripts/v1.3/metamorphic-run.ts [--transforms rename,split] [--style layered] [--variant v03-...]
 *        [--out results/v1.3-metamorphic] [--concurrency 3] [--keep] [--resolved-edges-in-literal-view]
 *   node --import tsx scripts/v1.3/metamorphic-run.ts --report [--out results/v1.3-metamorphic]   (offline: re-aggregate raw/)
 *
 * Writes <out>/raw/base/<style>/<variant>.json (the untransformed run), <out>/raw/<transform>/<style>/<variant>.json
 * (candidate, note, path maps, type-check result, reduced CLI output), <out>/summary.json and <out>/summary.md.
 * Transformed projects live in a work directory under the OS temporary directory (never under a `node_modules`
 * path, see `main`) and are deleted at the end unless --keep.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import YAML from 'yaml';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { CLI_ENTRY } from '../lib/freeze-gate-main.js';
import { normaliseFindingPath } from './lib/compare.js';
import { materialiseVariant } from './lib/materialise.js';
import {
  ALL_TRANSFORMS,
  CORE_TRANSFORMS,
  candidatesFor,
  isTransformName,
  layerKey,
  layerModelFromSpec,
  rewriteSpecArchitecture,
  summariseCliOutput,
} from './lib/metamorphic.js';
import type { LayerModel, RunSummary, TransformName, TransformOutcome } from './lib/metamorphic.js';
import { aggregate, renderSummary } from './lib/metamorphic-report.js';
import type { BaseRecord, TransformRecord } from './lib/metamorphic-report.js';
import { REFERENCE_STYLES, isReferenceStyle, loadAllReferences } from './lib/reference-model.js';
import type { LoadedReference, LoadedVariant, ReferenceStyle } from './lib/reference-model.js';
import { typecheckProject } from './lib/typecheck.js';

const repoRoot = process.cwd();
const argv = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const outDir = path.resolve(repoRoot, opt('--out') ?? 'results/v1.3-metamorphic');
const transforms = (opt('--transforms') ?? ALL_TRANSFORMS.join(',')).split(',').filter((t) => t !== '');
const badT = transforms.filter((t) => !isTransformName(t));
if (badT.length > 0) {
  process.stderr.write(`unknown transforms: ${badT.join(', ')} (known: ${ALL_TRANSFORMS.join(', ')})\n`);
  process.exit(2);
}
const styles = (opt('--style') ?? REFERENCE_STYLES.join(',')).split(',').filter((s) => s !== '');
if (!styles.every(isReferenceStyle)) {
  process.stderr.write(`--style takes ${REFERENCE_STYLES.join(', ')}\n`);
  process.exit(2);
}
const onlyVariant = opt('--variant');
const concurrency = Number(opt('--concurrency') ?? '3');
const keep = argv.includes('--keep');
// MT-B1 check: pass the OFF-by-default extractor option to every evaluation (base and transformed alike).
const extraCliArgs = argv.includes('--resolved-edges-in-literal-view') ? ['--resolved-edges-in-literal-view'] : [];
const reportOnly = argv.includes('--report');

const runner = new NodeProcessRunner();
const tsx = path.resolve(repoRoot, 'node_modules/.bin/tsx');
const childEnv: Record<string, string> = {};
for (const k of ['PATH', 'HOME']) {
  const v = process.env[k];
  if (v !== undefined) childEnv[k] = v;
}

async function evaluate(projectDir: string, specPath: string): Promise<RunSummary & { rows: number }> {
  const args = [CLI_ENTRY, 'evaluate', '--project', projectDir, '--spec', specPath, '--format', 'json', '--symbolic-only', '--neo4j-uri', '', '--engine', 'cypher-interp', ...extraCliArgs];
  const run = await runner.run(tsx, args, { cwd: repoRoot, env: childEnv, timeoutMs: 600_000 });
  if (!run.success) throw new Error(run.errors.map((e) => e.message).join('; '));
  if (run.data.timedOut) throw new Error(`evaluation of ${projectDir} timed out`);
  const stdout = run.data.stdout;
  const start = stdout.indexOf('{');
  if (start < 0) throw new Error(`no JSON from evaluate on ${projectDir}: ${run.data.stderr.slice(0, 500)}`);
  const parsed = JSON.parse(stdout.slice(start)) as Parameters<typeof summariseCliOutput>[0] & { violations?: unknown[] };
  const summary = summariseCliOutput(parsed, (p) => normaliseFindingPath(p, projectDir));
  return { ...summary, rows: Array.isArray(parsed.violations) ? parsed.violations.length : 0 };
}

function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

/** Rows of the committed Neo4j reference run, to check the untransformed cypher-interp run against. */
function committedRows(style: string, variant: string): string[] | undefined {
  const file = path.join(repoRoot, 'results/v1.3-reference/after-member-facts/raw', style, `${variant}.json`);
  if (!fs.existsSync(file)) return undefined;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { findings: { ruleId: string; file: string; target?: string }[] };
  return parsed.findings.map((f) => `${f.ruleId}|${f.file}|${f.target ?? ''}`).sort();
}

async function pool<T>(items: readonly T[], n: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.max(1, n) }, async () => {
    while (next < items.length) {
      const i = next;
      next += 1;
      await fn(items[i] as T);
    }
  });
  await Promise.all(workers);
}

function definingRules(v: LoadedVariant): string[] {
  if (v.manifest.kind !== 'violation') return [];
  const ids = [...new Set(v.manifest.expectedFindings.map((f) => f.ruleId))];
  return ids.length > 0 ? ids.sort() : v.manifest.plants !== null ? [v.manifest.plants] : [];
}

function focusFiles(v: LoadedVariant): string[] {
  return [...new Set(v.manifest.expectedFindings.flatMap((f) => [f.file, ...(f.target !== undefined ? [f.target] : [])]))].filter((f) => !f.includes(','));
}

function layerModelOf(ref: LoadedReference): ReturnType<typeof layerModelFromSpec> {
  return layerModelFromSpec(YAML.parse(fs.readFileSync(ref.specPath, 'utf8')) as Parameters<typeof layerModelFromSpec>[0]);
}

async function applyTransform(name: TransformName, baseDir: string, workDir: string, v: LoadedVariant, model: LayerModel): Promise<{ label: string; outcome: TransformOutcome | undefined; tsc: string[]; tried: number; errors: string[] }> {
  const reset = (): void => {
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.cpSync(baseDir, workDir, { recursive: true });
  };
  reset();
  const candidates = candidatesFor(name, workDir, { focus: focusFiles(v), layerOf: (f) => layerKey(model, f) });
  const errors: string[] = [];
  let lastTsc: string[] = [];
  let tried = 0;
  for (const c of candidates) {
    tried += 1;
    reset();
    let out: TransformOutcome;
    try {
      out = await c.apply(workDir);
    } catch (e) {
      errors.push(`${c.label}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (!out.applied) return { label: c.label, outcome: out, tsc: [], tried, errors };
    const diags = typecheckProject(workDir);
    if (diags.length === 0) return { label: c.label, outcome: out, tsc: [], tried, errors };
    lastTsc = diags.slice(0, 5);
    errors.push(`${c.label}: tsc: ${diags.slice(0, 3).join(' | ')}`);
  }
  return { label: candidates.length === 0 ? 'no candidate' : 'all candidates failed', outcome: undefined, tsc: lastTsc, tried, errors };
}

async function main(): Promise<number> {
  const refs = loadAllReferences(repoRoot, styles as ReferenceStyle[]);
  if (reportOnly) {
    const report = aggregate(outDir, refs.map((r) => ({ style: r.style, model: layerModelOf(r), variants: r.variants.map((v) => ({ variant: v.manifest.variant, kind: v.manifest.kind, definingRules: definingRules(v) })) })), [...ALL_TRANSFORMS], CORE_TRANSFORMS);
    writeJson(path.join(outDir, 'summary.json'), report);
    fs.writeFileSync(path.join(outDir, 'summary.md'), renderSummary(report));
    process.stdout.write(`summary written to ${path.relative(repoRoot, outDir)}\n`);
    return 0;
  }
  // Outside node_modules: the extractor treats a resolved file under a `node_modules` segment as an installed package,
  // which turns every `@app/*` alias import of a project copy there into a Package edge. The DDD project resolves a
  // bare package (v04's class-transformer) for tsc, so the work root gets a `node_modules` link to the repository's.
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-metamorphic-'));
  fs.symlinkSync(path.join(repoRoot, 'node_modules'), path.join(work, 'node_modules'), 'dir');
  process.stderr.write(`work directory ${work}\n`);
  try {
    interface Job { ref: LoadedReference; v: LoadedVariant; baseDir: string; model: LayerModel }
    const jobs: Job[] = [];
    for (const ref of refs) {
      const model = layerModelOf(ref);
      for (const v of ref.variants) {
        if (onlyVariant !== undefined && v.manifest.variant !== onlyVariant) continue;
        const m = materialiseVariant(ref, v, path.join(work, 'base'));
        jobs.push({ ref, v, baseDir: m.projectDir, model });
      }
    }
    // Untransformed runs (same location and engine as the transformed ones).
    await pool(jobs, concurrency, async (j) => {
      const tsc = typecheckProject(j.baseDir);
      const s = await evaluate(j.baseDir, j.ref.specPath);
      const committed = committedRows(j.ref.style, j.v.manifest.variant);
      const mine = [...s.blocking, ...s.advisory].map((r) => `${r.ruleId}|${r.file}|${r.target ?? ''}`).sort();
      const rec: BaseRecord = {
        style: j.ref.style,
        variant: j.v.manifest.variant,
        tscOk: tsc.length === 0,
        identicalToCommittedNeo4jRun: committed === undefined ? null : JSON.stringify(committed) === JSON.stringify(mine),
        summary: s,
      };
      writeJson(path.join(outDir, 'raw', 'base', j.ref.style, `${j.v.manifest.variant}.json`), rec);
      process.stdout.write(`base ${j.ref.style}/${j.v.manifest.variant}: ${String(s.blocking.length)} blocking rows${tsc.length > 0 ? ' (DOES NOT COMPILE)' : ''}\n`);
    });
    for (const t of transforms as TransformName[]) {
      await pool(jobs, concurrency, async (j) => {
        const workDir = path.join(work, t, j.ref.style, j.v.manifest.variant);
        const started = Date.now();
        const r = await applyTransform(t, j.baseDir, workDir, j.v, j.model);
        let summary: RunSummary | undefined;
        let evalError: string | undefined;
        let specPath = j.ref.specPath;
        let specReplaced: string[] = [];
        const rewritten = r.outcome?.specRenames === undefined ? undefined : rewriteSpecArchitecture(fs.readFileSync(j.ref.specPath, 'utf8'), r.outcome.specRenames);
        if (rewritten !== undefined) {
          specPath = `${workDir}.spec.yaml`;
          fs.writeFileSync(specPath, rewritten.text);
          specReplaced = rewritten.replaced;
        }
        if (r.outcome?.applied === true) {
          try {
            summary = await evaluate(workDir, specPath);
          } catch (e) {
            evalError = e instanceof Error ? e.message : String(e);
          }
        }
        const rec: TransformRecord = {
          transform: t,
          style: j.ref.style,
          variant: j.v.manifest.variant,
          candidate: r.label,
          candidatesTried: r.tried,
          applied: r.outcome?.applied ?? false,
          transformed: r.outcome !== undefined,
          note: r.outcome?.note ?? r.errors.join(' || '),
          tscOk: r.outcome !== undefined && r.tsc.length === 0,
          tscDiagnostics: r.tsc,
          candidateErrors: r.errors,
          origCanon: r.outcome?.origCanon ?? {},
          newCanon: r.outcome?.newCanon ?? {},
          specReplaced,
          ...(summary !== undefined ? { summary } : {}),
          ...(evalError !== undefined ? { evalError } : {}),
          elapsedMs: Date.now() - started,
        };
        writeJson(path.join(outDir, 'raw', t, j.ref.style, `${j.v.manifest.variant}.json`), { ...rec, elapsedMs: undefined });
        process.stdout.write(`${t} ${j.ref.style}/${j.v.manifest.variant}: ${rec.applied ? (summary !== undefined ? `${String(summary.blocking.length)} blocking rows` : `FAILED ${evalError ?? ''}`) : rec.transformed ? 'n/a' : 'NO CANDIDATE TYPE-CHECKS'} (${r.label})\n`);
        if (!keep) fs.rmSync(workDir, { recursive: true, force: true });
        if (!keep && rewritten !== undefined) fs.rmSync(specPath, { force: true });
      });
    }
  } finally {
    fs.unlinkSync(path.join(work, 'node_modules')); // the link first, so no removal can reach the repository's packages
    if (!keep) fs.rmSync(work, { recursive: true, force: true });
  }
  return 0;
}

void main().then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exitCode = 1;
  },
);
