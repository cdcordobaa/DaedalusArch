/**
 * FR-V5 skeleton: the end-to-end validation runner over the v1.3 reference projects (FR-V3).
 *
 * Modes (exactly one):
 *   --check                 load and schema-validate every manifest, run the cross-checks, apply every patch or
 *                           overlay to a temporary copy and type-check it; no evaluation (needs no Neo4j)
 *   --materialise <dir>     write every variant to <dir>/<style>/<variant> (for a manual run or inspection)
 *   --from-raw <dir>        compare saved tool outputs (<dir>/<style>/<variant>.json) with the manifests
 *   (default, live)         materialise each variant, run `firewall evaluate --symbolic-only --format json` on it
 *                           (Neo4j required: NEO4J_URI and NEO4J_PASSWORD), save the raw rows, compare
 * Common options: --style <a,b>  --out <dir> (report directory; default results/v1.3-reference)
 *                 --set <reference|devset-b>  which reference set to load (default `reference`, the 71-case set
 *                 under tests/fixtures/v1.3-reference; `devset-b` is the separate expansion set under
 *                 tests/fixtures/v1.3-devset-b, whose default report directory is results/v1.3-devset-b)
 *
 * The runner never edits a manifest: a disagreement is a reported mismatch (anti-circularity rule,
 * Docs/v1.3-reference-notes.md §6).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { NodeProcessRunner } from '../../../src/shared/process/node-process-runner.js';
import { acquireNeo4jLock } from '../../../src/shared/process/neo4j-lock.js';
import { cliEvaluate } from '../../lib/freeze-gate-main.js';
import { compareVariant, normaliseFindingPath, renderMarkdown, styleMetrics } from './compare.js';
import type { ActualFinding, StyleMetrics, VariantComparison } from './compare.js';
import { makeTempRoot, materialiseVariant } from './materialise.js';
import { DEVSET_B_ROOT, REFERENCE_ROOT, REFERENCE_STYLES, crossCheck, isReferenceStyle, loadAllReferences } from './reference-model.js';
import { typecheckProject } from './typecheck.js';
import type { LoadedReference, ReferenceStyle } from './reference-model.js';

export type Evaluator = (projectDir: string, specPath: string) => Promise<readonly ActualFinding[]>;

export interface MainDeps {
  readonly env: NodeJS.ProcessEnv;
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
  /** Built from `env` (CLI subprocess against Neo4j) when absent. */
  readonly evaluate?: Evaluator;
}

interface Args {
  readonly mode: 'check' | 'materialise' | 'from-raw' | 'live';
  readonly dir?: string;
  readonly styles: readonly ReferenceStyle[];
  readonly out: string;
  /** Fixture root of the selected reference set (`--set`). */
  readonly root: string;
}

/** The reference sets `--set` accepts: fixture root and default report directory. */
export const REFERENCE_SETS: Readonly<Record<string, { readonly root: string; readonly out: string }>> = {
  reference: { root: REFERENCE_ROOT, out: 'results/v1.3-reference' },
  'devset-b': { root: DEVSET_B_ROOT, out: 'results/v1.3-devset-b' },
};

export const LIVE_REFUSAL =
  'live run needs Neo4j: set NEO4J_URI and NEO4J_PASSWORD (see README), or use --check, --materialise <dir> or --from-raw <dir>';

export function parseArgs(argv: readonly string[]): Args | string {
  let mode: Args['mode'] = 'live';
  let dir: string | undefined;
  let styles: ReferenceStyle[] = [...REFERENCE_STYLES];
  let out: string | undefined;
  let set = 'reference';
  let modes = 0;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const value = (): string | undefined => {
      i += 1;
      return argv[i];
    };
    if (a === '--check') {
      mode = 'check';
      modes += 1;
    } else if (a === '--materialise' || a === '--from-raw') {
      mode = a === '--materialise' ? 'materialise' : 'from-raw';
      modes += 1;
      dir = value();
      if (dir === undefined) return `${a} needs a directory`;
    } else if (a === '--style') {
      const list = (value() ?? '').split(',').filter((s) => s.length > 0);
      const bad = list.filter((s) => !isReferenceStyle(s));
      if (list.length === 0 || bad.length > 0) return `--style takes a comma list of ${REFERENCE_STYLES.join(', ')}`;
      styles = list as ReferenceStyle[];
    } else if (a === '--set') {
      const v = value();
      if (v === undefined || REFERENCE_SETS[v] === undefined) return `--set takes one of ${Object.keys(REFERENCE_SETS).join(', ')}`;
      set = v;
    } else if (a === '--out') {
      const v = value();
      if (v === undefined) return '--out needs a directory';
      out = v;
    } else {
      return `unexpected argument ${JSON.stringify(a)}`;
    }
  }
  if (modes > 1) return 'choose one of --check, --materialise, --from-raw';
  const chosen = REFERENCE_SETS[set] ?? { root: REFERENCE_ROOT, out: 'results/v1.3-reference' };
  return { mode, styles, out: out ?? chosen.out, root: chosen.root, ...(dir !== undefined ? { dir } : {}) };
}

/** The live evaluator: `bin/firewall.ts evaluate --symbolic-only --format json` per variant, through the CLI. */
export function liveEvaluator(repoRoot: string, env: NodeJS.ProcessEnv): Evaluator {
  const evaluate = cliEvaluate(new NodeProcessRunner(), repoRoot, env);
  return async (projectDir, specPath) => {
    const result = await evaluate(projectDir, specPath);
    if (!result.success) throw new Error(result.errors.map((e) => e.message).join('; '));
    return result.data.violations.map((v) => {
      const target = normaliseFindingPath(v.target ?? '', projectDir);
      return { ruleId: v.functionId, file: normaliseFindingPath(v.filePath, projectDir), ...(target !== '' ? { target } : {}) };
    });
  };
}

function readRaw(dir: string, style: string, variant: string): readonly ActualFinding[] {
  const file = path.join(dir, style, `${variant}.json`);
  if (!fs.existsSync(file)) throw new Error(`no saved output ${file}`);
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as { findings?: unknown };
  if (!Array.isArray(parsed.findings)) throw new Error(`${file}: no findings array`);
  return parsed.findings as ActualFinding[];
}

export interface RunResult {
  readonly comparisons: readonly VariantComparison[];
  readonly metrics: readonly StyleMetrics[];
}

/** Compares every variant of `refs`, taking each variant's rows from `actualOf`. */
export async function compareAll(
  refs: readonly LoadedReference[],
  actualOf: (ref: LoadedReference, variant: string) => Promise<readonly ActualFinding[]>,
): Promise<RunResult> {
  const comparisons: VariantComparison[] = [];
  const metrics: StyleMetrics[] = [];
  for (const ref of refs) {
    const scope = new Set(ref.descriptor.scopeRules.map((r) => r.ruleId));
    const clean = ref.variants.find((v) => v.manifest.kind === 'clean');
    const cleanActual = clean === undefined ? undefined : await actualOf(ref, clean.manifest.variant);
    const own: VariantComparison[] = [];
    for (const v of ref.variants) {
      const actual = v === clean && cleanActual !== undefined ? cleanActual : await actualOf(ref, v.manifest.variant);
      own.push(compareVariant(ref.style, v.manifest, actual, scope, cleanActual));
    }
    comparisons.push(...own);
    metrics.push(styleMetrics(ref, own));
  }
  return { comparisons, metrics };
}

function writeReport(outDir: string, run: RunResult, header: string): void {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify({ header, metrics: run.metrics, comparisons: run.comparisons }, null, 2) + '\n');
  fs.writeFileSync(path.join(outDir, 'report.md'), renderMarkdown(run.metrics, run.comparisons, header));
}

/** Runs the runner; returns the exit code (0 ok, 1 a check or patch failed, 2 usage or environment). */
export async function main(argv: readonly string[], repoRoot: string, deps: MainDeps): Promise<number> {
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    deps.err(`${args}\n`);
    return 2;
  }
  const refs = loadAllReferences(repoRoot, args.styles, args.root);
  const problems = refs.flatMap(crossCheck);
  if (problems.length > 0) {
    deps.err(problems.map((p) => `cross-check: ${p}`).join('\n') + '\n');
    return 1;
  }

  if (args.mode === 'check' || args.mode === 'materialise') {
    const check = args.mode === 'check';
    // --check compiles every variant. Patch-format projects vendor their framework typings and are checked in the
    // OS temp directory (as their unit tests do); the overlay-format DDD project resolves bare packages (v04's
    // class-transformer) from the repository's node_modules, so it is checked under node_modules/.cache.
    const roots = new Map<string, string>();
    const rootFor = (ref: LoadedReference): string => {
      if (!check) return path.resolve(repoRoot, args.dir ?? '');
      let root = roots.get(ref.format);
      if (root === undefined) {
        if (ref.format === 'overlay') {
          const cache = path.join(repoRoot, 'node_modules', '.cache');
          fs.mkdirSync(cache, { recursive: true });
          root = fs.mkdtempSync(path.join(cache, 'v13-reference-check-'));
        } else root = makeTempRoot();
        roots.set(ref.format, root);
      }
      return root;
    };
    let failed = 0;
    try {
      for (const ref of refs) {
        let styleFailed = 0;
        for (const v of ref.variants) {
          try {
            const m = materialiseVariant(ref, v, rootFor(ref));
            const how = ref.format === 'overlay' ? 'overlay' : 'patch';
            let compiled = '';
            if (check) {
              const diagnostics = typecheckProject(m.projectDir);
              if (diagnostics.length > 0) {
                styleFailed += 1;
                deps.err(`${ref.style}/${v.manifest.variant}: does not compile: ${diagnostics.slice(0, 5).join(' | ')}${diagnostics.length > 5 ? ` (+${String(diagnostics.length - 5)} more)` : ''}\n`);
              }
              compiled = diagnostics.length === 0 ? ', compiles' : ', DOES NOT COMPILE';
            }
            deps.out(`${ref.style}/${v.manifest.variant}: ${v.manifest.kind}, ${String(v.manifest.expectedFindings.length)} expected, ${how} touches ${m.touched.length === 0 ? 'nothing' : m.touched.join(', ')}${compiled}\n`);
          } catch (e) {
            styleFailed += 1;
            deps.err(`${e instanceof Error ? e.message : String(e)}\n`);
          }
        }
        failed += styleFailed;
        if (check) {
          const blocking = ref.descriptor.scopeRules.filter((r) => r.blockingCandidate).map((r) => r.ruleId);
          deps.out(`${ref.style}: ${styleFailed === 0 ? 'ok' : `${String(styleFailed)} FAILED`}, ${String(ref.variants.length)} variants (${ref.format} format); blocking (v1.3 tiers): ${blocking.join(', ') || 'none'}\n`);
        }
      }
    } finally {
      if (check) for (const root of roots.values()) fs.rmSync(root, { recursive: true, force: true });
    }
    if (!check) deps.out(`materialised under ${path.resolve(repoRoot, args.dir ?? '')}\n`);
    return failed === 0 ? 0 : 1;
  }

  if (args.mode === 'from-raw') {
    const rawDir = path.resolve(repoRoot, args.dir ?? '');
    const run = await compareAll(refs, (ref, variant) => Promise.resolve(readRaw(rawDir, ref.style, variant)));
    writeReport(path.resolve(repoRoot, args.out), run, `# v1.3 reference validation (from saved outputs in ${args.dir ?? ''})`);
    deps.out(renderMarkdown(run.metrics, [], '# v1.3 reference validation'));
    return 0;
  }

  // live
  let evaluate = deps.evaluate;
  if (evaluate === undefined) {
    if ((deps.env.NEO4J_URI ?? '') === '' || (deps.env.NEO4J_PASSWORD ?? '') === '') {
      deps.err(`${LIVE_REFUSAL}\n`);
      return 2;
    }
    evaluate = liveEvaluator(repoRoot, deps.env);
  }
  const outDir = path.resolve(repoRoot, args.out);
  // v1.3 fix round: hold the cross-process Neo4j lock for the whole run, so no other ingestion (another worktree's
  // jest suite, another agent's run) can wipe the database between this run's ingestion and evaluation. The CLI
  // children see their ancestor's lock and do not wait for it.
  const uri = deps.env.NEO4J_URI ?? '';
  const lock = uri === '' ? undefined : await acquireNeo4jLock(uri, { label: 'validate-reference live run', env: deps.env, onWait: (t) => { deps.err(`${t}\n`); } });
  if (lock !== undefined) deps.err(`Neo4j lock ${lock.mode} (${lock.path})\n`);
  const work = makeTempRoot();
  try {
    const run = await compareAll(refs, async (ref, variant) => {
      const v = ref.variants.find((x) => x.manifest.variant === variant);
      if (v === undefined) throw new Error(`unknown variant ${variant}`);
      const m = materialiseVariant(ref, v, work);
      const findings = await evaluate(m.projectDir, ref.specPath);
      const rawFile = path.join(outDir, 'raw', ref.style, `${variant}.json`);
      fs.mkdirSync(path.dirname(rawFile), { recursive: true });
      fs.writeFileSync(rawFile, JSON.stringify({ style: ref.style, variant, findings }, null, 2) + '\n');
      deps.out(`${ref.style}/${variant}: ${String(findings.length)} rows\n`);
      return findings;
    });
    writeReport(outDir, run, '# v1.3 reference validation (live run)');
    deps.out(renderMarkdown(run.metrics, [], '# v1.3 reference validation'));
    return 0;
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
    lock?.release();
  }
}
