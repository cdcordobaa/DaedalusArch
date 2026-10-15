/**
 * APG v2 extraction cost: wall time of `extractAPG` and the peak RSS of a fresh process, per project, with
 * `V13_DEFAULT_OPTIONS` and with `V13_APG2_OPTIONS` (median of 3 runs each, every run in its own process so the
 * ts-morph caches start cold). Writes Docs/DiagnosticRuns/apg2-ablation-2026-10-15/cost.json and prints a markdown table.
 * Usage: `npx tsx scripts/apg2-cost.ts`.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { extractAPG, V13_APG2_OPTIONS, V13_DEFAULT_OPTIONS } from '../src/apg-extractor/index.js';

// Run from the repository root (as every script here).
const ROOT = process.cwd();
const SELF = process.argv[1] ?? 'scripts/apg2-cost.ts';
const PROJECTS = [
  'tests/fixtures/v1.3-reference/clean-architecture/project',
  'tests/fixtures/v1.3-reference/hexagonal/project',
  'tests/fixtures/v1.3-reference/layered/project',
  'tests/fixtures/v1.3-reference/nestjs/project',
  'tests/fixtures/v1.3-reference/ddd/clean',
  'fixtures/correct-reference',
  'fixtures/variant-c-everything',
  ...['type-flow', 'components', 'components-flat', 'public-api', 'async', 'io', 'control-clean'].map((p) => `tests/fixtures/v1.3-apg2/${p}`),
];
const RUNS = 3;

async function one(dir: string, mode: string): Promise<void> {
  const t0 = performance.now();
  const r = await extractAPG(join(ROOT, dir), mode === 'apg2' ? V13_APG2_OPTIONS : V13_DEFAULT_OPTIONS);
  const ms = performance.now() - t0;
  if (!r.success) throw new Error(r.errors.map((e) => e.message).join('; '));
  process.stdout.write(JSON.stringify({
    ms, maxRssKb: process.resourceUsage().maxRSS, nodes: r.data.nodes.length, edges: r.data.edges.length,
    files: r.data.parseCoverage.total, passes: r.data.apg2?.timingsMs ?? null,
  }));
}

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

async function main(): Promise<void> {
  const rows: Array<Record<string, unknown>> = [];
  const lines = ['| Project | Files | Nodes v1.3 → v2 | Edges v1.3 → v2 | Time v1.3 (ms) | Time v2 (ms) | Δ time | Peak RSS v1.3 (MB) | Peak RSS v2 (MB) | Δ RSS (MB) |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const dir of PROJECTS) {
    const res: Record<string, Array<Record<string, number>>> = { v13: [], apg2: [] };
    for (let i = 0; i < RUNS; i++) {
      for (const mode of ['v13', 'apg2']) {
        const r = spawnSync(process.execPath, ['--import', 'tsx', SELF, '--one', dir, mode], { cwd: ROOT, encoding: 'utf8' });
        if (r.status !== 0) throw new Error(r.stderr);
        res[mode]!.push(JSON.parse(r.stdout) as Record<string, number>);
      }
    }
    const m = (mode: string, k: string): number => median(res[mode]!.map((x) => x[k]!));
    const row = {
      project: dir, files: res['v13']![0]!['files'],
      nodes: [res['v13']![0]!['nodes'], res['apg2']![0]!['nodes']], edges: [res['v13']![0]!['edges'], res['apg2']![0]!['edges']],
      msV13: Math.round(m('v13', 'ms')), msApg2: Math.round(m('apg2', 'ms')),
      rssMbV13: Math.round(m('v13', 'maxRssKb') / 1024), rssMbApg2: Math.round(m('apg2', 'maxRssKb') / 1024),
      apg2Passes: res['apg2']![0]!['passes'],
    };
    rows.push(row);
    lines.push(`| ${dir} | ${String(row.files)} | ${String(row.nodes[0])} → ${String(row.nodes[1])} | ${String(row.edges[0])} → ${String(row.edges[1])} | ${String(row.msV13)} | ${String(row.msApg2)} | ${row.msApg2 - row.msV13 >= 0 ? '+' : ''}${String(row.msApg2 - row.msV13)} | ${String(row.rssMbV13)} | ${String(row.rssMbApg2)} | ${row.rssMbApg2 - row.rssMbV13 >= 0 ? '+' : ''}${String(row.rssMbApg2 - row.rssMbV13)} |`);
  }
  const out = join(ROOT, 'Docs/DiagnosticRuns/apg2-ablation-2026-10-15');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'cost.json'), JSON.stringify({ runs: RUNS, node: process.version, rows }, null, 2) + '\n');
  writeFileSync(join(out, 'cost.md'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
}

void (process.argv[2] === '--one' ? one(process.argv[3] ?? '', process.argv[4] ?? '') : main()).then(
  () => undefined,
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
