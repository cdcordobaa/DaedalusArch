/**
 * Scale-work equivalence harness (Docs/v1.3/scale.md). Entry file: no exports.
 *
 * Runs the real pipeline (built as the CLI builds it) in-process over the 71 v1.3 reference cases and the five golden
 * fixtures, and writes, per case and per scoring mode, two files:
 *   <out>/<suite>/<case>/<mode>.report.json   the `--format json` report, run-time fields removed
 *   <out>/<suite>/<case>/apg.json             the extracted APG (nodes, edges, warnings, counts)
 * Two output directories made before and after a change are compared with `diff -r`: byte-identical means the change
 * did not move any output. The removed report fields are the ones that differ between two runs of the same code:
 * `runId`, `durationMs`, `executionTimeMs`, `totalMs`, `timestamp`; the absolute case path becomes `<case>`.
 *
 * Usage (repository root; Neo4j env exported, never read from .env):
 *   npx tsx scripts/v1.3/validate-reference.ts --materialise /tmp/ref
 *   NEO4J_PASSWORD=... npx tsx scripts/v1.3/scale/equivalence.ts --cases /tmp/ref --out /tmp/eq-before
 * Options: --only <suite/case-prefix>   --modes v1.3,v1.2e   --neo4j-only (every query on Neo4j)
 *          --skip-excluded-sources (ts-morph loads the analysed and declaration files only)
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../../src/pipeline/types.js';
import { formatJSON } from '../../../src/scoring-engine/report-formatter.js';
import { REFERENCE_STYLES, loadAllReferences } from '../lib/reference-model.js';

type ScoringMode = 'v1.3' | 'v1.2e';
type Engine = 'accelerated' | 'neo4j';

interface Case {
  readonly suite: string;
  readonly id: string;
  readonly projectPath: string;
  readonly specPath: string;
}

const VOLATILE_KEYS = new Set(['runId', 'durationMs', 'executionTimeMs', 'totalMs', 'timestamp']);

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Removes the run-time keys at any depth and replaces the case root in every string. */
function stable(value: unknown, root: string): unknown {
  if (typeof value === 'string') return value.split(root).join('<case>');
  if (Array.isArray(value)) return value.map((v) => stable(v, root));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (!VOLATILE_KEYS.has(k)) out[k] = stable(v, root);
    }
    return out;
  }
  return value;
}

function cases(repoRoot: string, materialised: string): Case[] {
  const list: Case[] = [];
  for (const ref of loadAllReferences(repoRoot, REFERENCE_STYLES)) {
    const styleDir = path.join(materialised, ref.style);
    for (const variant of fs.readdirSync(styleDir).sort()) {
      list.push({ suite: `reference/${ref.style}`, id: variant, projectPath: path.join(styleDir, variant), specPath: ref.specPath });
    }
  }
  for (const id of ['correct-reference', 'variant-a-structural', 'variant-b-pattern', 'variant-c-everything', 'variant-d-subtle']) {
    list.push({ suite: 'golden', id, projectPath: path.join(repoRoot, 'fixtures', id), specPath: path.join(repoRoot, 'specs', 'clean-arch.yaml') });
  }
  return list;
}

async function runCase(c: Case, scoringMode: ScoringMode, password: string, engine: Engine, events: string[], skipExcluded: boolean): Promise<{ report: string; apg: string }> {
  const apgStorePath = fs.mkdtempSync(path.join(os.tmpdir(), 'scale-eq-'));
  const config: PipelineConfig = {
    projectPath: c.projectPath,
    specFilePath: c.specPath,
    neo4jUri: process.env['NEO4J_URI'] ?? 'bolt://localhost:7687',
    neo4jUser: process.env['NEO4J_USER'] ?? 'neo4j',
    neo4jPassword: password,
    evaluationMode: 'symbolic-only',
    pipelineMode: 'stateless',
    persist: false,
    diff: false,
    verbose: false,
    apgStorePath,
    llmConfig: undefined,
    instrumentVersion: 2,
    neuralAggregation: 'registered',
    scoringMode,
    ...(engine === 'neo4j' && { queryEngine: 'neo4j' as const }),
    ...(skipExcluded && { sourceScope: 'analysed' as const }),
    onAcceleration: (e) => { events.push(`${e.query.name}:${e.query.filter}:${e.engine}`); },
  };
  const bundle = createPipeline(config);
  try {
    const result = await bundle.executor.execute();
    if (!result.success) throw new Error(`${c.suite}/${c.id}: ${result.errors.map((e) => `${e.code} ${e.message}`).join('; ')}`);
    const root = path.resolve(c.projectPath);
    const report = `${JSON.stringify(stable(JSON.parse(formatJSON(result.data)), root), null, 2)}\n`;
    const apgResult = bundle.context.snapshot().apgResult;
    const apg = `${JSON.stringify(stable(apgResult, root), null, 2)}\n`;
    return { report, apg };
  } finally {
    await bundle.cleanup();
    fs.rmSync(apgStorePath, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const materialised = arg(argv, '--cases');
  const out = arg(argv, '--out');
  const password = process.env['NEO4J_PASSWORD'];
  if (materialised === undefined || out === undefined || password === undefined || password === '') {
    process.stderr.write('usage: NEO4J_PASSWORD=... equivalence.ts --cases <materialised dir> --out <dir> [--only <prefix>] [--modes v1.3,v1.2e]\n');
    return 2;
  }
  const only = arg(argv, '--only');
  const modes = (arg(argv, '--modes') ?? 'v1.3,v1.2e').split(',') as ScoringMode[];
  const repoRoot = process.cwd();
  const all = cases(repoRoot, path.resolve(materialised)).filter((c) => only === undefined || `${c.suite}/${c.id}`.startsWith(only));
  const engine: Engine = argv.includes('--neo4j-only') ? 'neo4j' : 'accelerated';
  const skipExcluded = argv.includes('--skip-excluded-sources');
  const tally = new Map<string, number>();
  const started = Date.now();
  for (const c of all) {
    const dir = path.join(out, c.suite, c.id);
    fs.mkdirSync(dir, { recursive: true });
    for (const mode of modes) {
      const events: string[] = [];
      const { report, apg } = await runCase(c, mode, password, engine, events, skipExcluded);
      for (const e of events) tally.set(e, (tally.get(e) ?? 0) + 1);
      fs.writeFileSync(path.join(dir, `${mode}.report.json`), report);
      fs.writeFileSync(path.join(dir, 'apg.json'), apg);
    }
    process.stderr.write(`${c.suite}/${c.id}\n`);
  }
  process.stderr.write(`${String(all.length)} cases, ${String(Date.now() - started)} ms, engine ${engine}${skipExcluded ? ', analysed sources only' : ''}\n`);
  for (const [k, v] of [...tally].sort()) process.stderr.write(`  ${k}: ${String(v)}\n`);
  return 0;
}

main().then(
  (code) => { process.exitCode = code; },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 1;
  },
);
