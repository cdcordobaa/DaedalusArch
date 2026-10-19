/**
 * Scale profile of the full pipeline on one project (Docs/v1.3/scale.md). Entry file: no exports.
 *
 * Runs the pipeline exactly as `firewall evaluate --symbolic-only` builds it, and records per executor stage the wall
 * time and the process peak RSS at the end of the stage, per rule the evaluation time, and the graph size. Run one
 * project per process: the peak RSS is the process's own.
 *
 * Usage (repository root; Neo4j env exported, never read from .env):
 *   NEO4J_PASSWORD=... node --import tsx scripts/v1.3/scale/profile.ts --project <dir> --spec <yaml> \
 *     [--tsconfig <file>] [--label <id>] [--out <file.json>] [--report <file.json>] [--neo4j-only] [--skip-excluded-sources]
 * `--neo4j-only` sends every query to Neo4j (`queryEngine: 'neo4j'`, the behaviour before the scale work).
 * `--skip-excluded-sources` loads only the analysed and declaration files into ts-morph (`sourceScope: 'analysed'`).
 * `--report` also writes the stable JSON report (as `equivalence.ts` does) for a before/after diff.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createPipeline } from '../../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../../src/pipeline/types.js';
import { formatJSON } from '../../../src/scoring-engine/report-formatter.js';

const VOLATILE_KEYS = new Set(['runId', 'durationMs', 'executionTimeMs', 'totalMs', 'timestamp']);

function arg(argv: readonly string[], name: string): string | undefined {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

function stable(value: unknown, root: string): unknown {
  if (typeof value === 'string') return value.split(root).join('<case>');
  if (Array.isArray(value)) return value.map((v) => stable(v, root));
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) if (!VOLATILE_KEYS.has(k)) out[k] = stable(v, root);
    return out;
  }
  return value;
}

const peakRssMb = (): number => Math.round(process.resourceUsage().maxRSS / 1024);

async function main(): Promise<number> {
  const argv = process.argv.slice(2);
  const project = arg(argv, '--project');
  const spec = arg(argv, '--spec');
  const password = process.env['NEO4J_PASSWORD'];
  if (project === undefined || spec === undefined || password === undefined || password === '') {
    process.stderr.write('usage: NEO4J_PASSWORD=... profile.ts --project <dir> --spec <yaml> [--tsconfig <file>] [--label <id>] [--out <file>] [--report <file>]\n');
    return 2;
  }
  const tsconfig = arg(argv, '--tsconfig');
  const label = arg(argv, '--label') ?? path.basename(project);
  const apgStorePath = fs.mkdtempSync(path.join(os.tmpdir(), 'scale-profile-'));
  const accelerations: { query: string; filter: string; engine: string; ms: number }[] = [];
  const config: PipelineConfig = {
    projectPath: project,
    specFilePath: spec,
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
    ...(tsconfig !== undefined && { tsconfigPath: tsconfig }),
    instrumentVersion: 2,
    neuralAggregation: 'registered',
    scoringMode: 'v1.3',
    ...(argv.includes('--neo4j-only') && { queryEngine: 'neo4j' as const }),
    ...(argv.includes('--skip-excluded-sources') && { sourceScope: 'analysed' as const }),
    onAcceleration: (e) => { accelerations.push({ query: e.query.name, filter: e.query.filter, engine: e.engine, ms: Math.round(e.durationMs) }); },
  };
  const bundle = createPipeline({ ...config, postSealRules: false }); // v1.4 U2: the sealed v1.3 rule set (BR-U2-10)
  const stageRss: { name: string; peakRssMb: number }[] = [];
  for (const command of bundle.commands) {
    const run = command.execute.bind(command);
    (command as { execute: typeof command.execute }).execute = async (ctx) => {
      const r = await run(ctx);
      stageRss.push({ name: command.name, peakRssMb: peakRssMb() });
      return r;
    };
  }
  const started = Date.now();
  try {
    const result = await bundle.executor.execute();
    const wallMs = Date.now() - started;
    const timings = bundle.executor.getTimings();
    if (!result.success) {
      process.stderr.write(`${label}: ${result.errors.map((e) => `${e.code} ${e.message}`).join('; ')}\n`);
      const failed = { label, ok: false, wallMs, peakRssMb: peakRssMb(), stages: timings.stages, stageRss, errors: result.errors.map((e) => ({ code: e.code, message: e.message })) };
      const out = arg(argv, '--out');
      if (out !== undefined) fs.writeFileSync(out, `${JSON.stringify(failed, null, 2)}\n`);
      return 1;
    }
    const report = result.data;
    const rules = report.functionResults
      .map((f) => ({ functionId: f.functionId, name: f.name, ms: f.executionTimeMs, violations: f.violationCount }))
      .sort((a, b) => b.ms - a.ms);
    const profile = {
      label,
      ok: true,
      node: process.version,
      wallMs,
      peakRssMb: peakRssMb(),
      files: report.parseCoverage.total,
      graph: { nodes: report.graphStats.nodeCount, edges: report.graphStats.edgeCount },
      stages: timings.stages.map((s) => ({ ...s, peakRssMb: stageRss.find((r) => r.name === s.name)?.peakRssMb })),
      rules,
      accelerations,
      violations: report.violations.length,
      verdict: report.verdict,
    };
    const out = arg(argv, '--out');
    if (out !== undefined) fs.writeFileSync(out, `${JSON.stringify(profile, null, 2)}\n`);
    const reportOut = arg(argv, '--report');
    if (reportOut !== undefined) {
      fs.writeFileSync(reportOut, `${JSON.stringify(stable(JSON.parse(formatJSON(report)), path.resolve(project)), null, 2)}\n`);
    }
    process.stderr.write(`${label}: ${String(profile.files)} files, ${String(wallMs)} ms, peak ${String(profile.peakRssMb)} MB\n`);
    for (const s of profile.stages) process.stderr.write(`  ${s.name}: ${String(s.durationMs)} ms (peak ${String(s.peakRssMb ?? '-')} MB)\n`);
    for (const a of accelerations) process.stderr.write(`  accelerated ${a.query} (${a.filter}): ${a.engine}, ${String(a.ms)} ms\n`);
    for (const r of rules.slice(0, 5)) process.stderr.write(`  rule ${r.functionId} ${r.name}: ${String(r.ms)} ms\n`);
    return 0;
  } finally {
    await bundle.cleanup();
    fs.rmSync(apgStorePath, { recursive: true, force: true });
  }
}

main().then(
  (code) => { process.exitCode = code; },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exitCode = 1;
  },
);
