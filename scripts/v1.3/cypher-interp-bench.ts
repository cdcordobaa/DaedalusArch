/**
 * Warm in-process latency of one symbolic evaluation, per graph engine (Docs/v1.3/cypher-interpreter.md §6): the
 * pipeline (extract → ingest → compile → evaluate → score → report) runs N times in one process on one reference
 * variant, so CLI start-up and module loading are excluded, as in a long-lived MCP server. Entry file: no exports.
 * Usage: node --import tsx scripts/v1.3/cypher-interp-bench.ts [--variant clean-architecture/clean] [--n 5]
 * The `neo4j` engine runs only when NEO4J_URI and NEO4J_PASSWORD are set.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createPipeline } from '../../src/pipeline/pipeline-factory.js';
import type { PipelineConfig } from '../../src/pipeline/types.js';
import type { GraphEngine } from '../../src/cypher-interp/engine.js';
import { makeTempRoot } from './lib/materialise.js';
import { referenceProjects } from './lib/memory-projects.js';

const argv = process.argv.slice(2);
const opt = (n: string): string | undefined => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const variant = opt('--variant') ?? 'clean-architecture/clean';
const n = Number(opt('--n') ?? '5');
const env = process.env;

async function main(): Promise<void> {
  const proj = referenceProjects(process.cwd(), (id) => id === variant)[0];
  if (proj === undefined) throw new Error(`no variant ${variant}`);
  const work = makeTempRoot('cypher-interp-bench-');
  try {
    const dir = proj.materialise(work);
    const engines: GraphEngine[] = ['cypher-interp', ...((env.NEO4J_URI ?? '') !== '' && (env.NEO4J_PASSWORD ?? '') !== '' ? ['neo4j' as const] : [])];
    for (const engine of engines) {
      const times: number[] = [];
      const stages = new Map<string, number[]>();
      for (let i = 0; i < n; i++) {
        const config: PipelineConfig = {
          projectPath: dir, specFilePath: proj.specPath, neo4jUri: env.NEO4J_URI ?? '', neo4jUser: env.NEO4J_USER ?? 'neo4j', neo4jPassword: env.NEO4J_PASSWORD ?? '',
          evaluationMode: 'symbolic-only', pipelineMode: 'stateless', persist: false, diff: false, verbose: false,
          apgStorePath: path.join(work, '.apg-store'), scoringMode: 'v1.3', graphEngine: engine,
        };
        const { executor, cleanup } = createPipeline({ ...config, postSealRules: false }); // v1.4 U2: the sealed v1.3 rule set (BR-U2-10)
        const t0 = performance.now();
        const r = await executor.execute();
        times.push(performance.now() - t0);
        await cleanup();
        if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
        for (const s of executor.getTimings().stages) { const l = stages.get(s.name) ?? []; l.push(s.durationMs); stages.set(s.name, l); }
      }
      const med = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
      process.stdout.write(`${engine}: first ${times[0]?.toFixed(0) ?? '?'} ms, warm median ${med(times.slice(1)).toFixed(0)} ms over ${String(n - 1)}; stages (median): ${[...stages].map(([k, v]) => `${k} ${med(v).toFixed(0)}`).join(', ')}\n`);
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

void main().catch((e: unknown) => { process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`); process.exitCode = 2; });
