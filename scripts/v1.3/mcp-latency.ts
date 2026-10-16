/**
 * MCP v2 latency: p50 / p95 per tool on the v1.3 reference projects, through the tool handlers of a long-lived server
 * context (one per style, as one MCP server process per project; the spec is parsed once and cached). Entry file.
 *
 *   npx tsx scripts/v1.3/mcp-latency.ts [--runs 5] [--infer-runs 3] [--out results/v1.3-reference/mcp-v2] [--check]
 *
 * Calls per run, per style: for every variant, check_file on each changed source file (whole new content), check_import
 * on each of its imports, which_layer on it, check_diff on the variant's diff (before-write: project = clean; after-write:
 * project = variant), get_architecture_spec, explain_finding and explain_violation on each blocking finding, and three
 * suggest_placement purposes; infer_spec once per style per --infer-runs. The first call of each tool per style is the
 * cold call (module and parser warm-up) and is reported apart. evaluate_project is not measured (needs Neo4j).
 * `--check` exits 1 when check_file or check_diff p95 is 1000 ms or more.
 *
 * `--stdio` also measures the built server (`dist/mcp-server/main.js`, `npm run build`) as an MCP client sees it: the
 * process start-up to the first listTools, and check_file / check_diff round trips over stdio, per style.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadAllReferences } from './lib/reference-model.js';
import { makeTempRoot, materialiseVariant } from './lib/materialise.js';
import { percentile, projectDiff } from './lib/mcp-consistency.js';
import {
  checkDiffTool,
  checkFileTool,
  checkImportTool,
  createSpecLoader,
  explainFindingTool,
  explainViolationTool,
  getArchitectureSpec,
  inferSpecTool,
  suggestPlacementTool,
  whichLayerTool,
} from '../../src/mcp-server/tools.js';
import type { ServerContext, ToolOutcome } from '../../src/mcp-server/tools.js';
import { scanSource } from '../../src/mcp-server/source-scan.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const TARGET_MS = 1000;

function context(specPath: string, projectPath: string, presetsDir: string): ServerContext {
  const refuse = (): never => {
    throw new Error('evaluate_project is not measured');
  };
  return { defaultSpecPath: specPath, defaultProjectPath: projectPath, env: {}, loadSpec: createSpecLoader(), presetsDir, evaluateDeps: { makeGraph: refuse, makePipeline: refuse } };
}

interface Sample {
  readonly tool: string;
  readonly style: string;
  readonly ms: number;
  readonly cold: boolean;
}

function arg(argv: readonly string[], name: string, fallback: string): string {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] ?? fallback : fallback;
}

async function main(argv: readonly string[]): Promise<number> {
  const repo = process.cwd();
  const runs = Number(arg(argv, '--runs', '5'));
  const inferRuns = Number(arg(argv, '--infer-runs', '3'));
  const outDir = path.resolve(repo, arg(argv, '--out', 'results/v1.3-reference/mcp-v2'));
  const presetsDir = path.join(repo, 'presets');
  const samples: Sample[] = [];
  const tmp = makeTempRoot('mcp-latency-');
  const seen = new Set<string>();
  const time = async <T>(tool: string, style: string, fn: () => Promise<ToolOutcome<T>>): Promise<T> => {
    const t0 = performance.now();
    const res = await fn();
    const ms = performance.now() - t0;
    const k = `${tool}|${style}`;
    samples.push({ tool, style, ms, cold: !seen.has(k) });
    seen.add(k);
    if (!res.ok) throw new Error(`${tool} (${style}) failed: ${res.message}`);
    return res.data;
  };
  try {
    const refs = loadAllReferences(repo);
    // Materialise once; every run reuses the directories.
    const prepared = refs.map((ref) => {
      const cleanVariant = ref.variants.find((v) => v.manifest.variant === 'clean');
      if (cleanVariant === undefined) throw new Error(`${ref.style}: no clean variant`);
      const clean = materialiseVariant(ref, cleanVariant, path.join(tmp, 'clean'));
      const variants = ref.variants
        .filter((v) => v.manifest.variant !== 'clean')
        .map((v) => {
          const m = materialiseVariant(ref, v, path.join(tmp, 'variants'));
          const diff = projectDiff(clean.projectDir, m.projectDir);
          const files = m.touched.filter((f) => /\.(?:[cm]?[jt]sx?)$/.test(f) && fs.existsSync(path.join(m.projectDir, f)));
          return { id: v.manifest.variant, dir: m.projectDir, diff, files };
        });
      return { ref, clean, variants };
    });
    for (let run = 0; run < runs; run++) {
      for (const { ref, clean, variants } of prepared) {
        const ctx = context(ref.specPath, clean.projectDir, presetsDir);
        const style = ref.style;
        await time('get_architecture_spec', style, () => getArchitectureSpec(ctx, {}));
        for (const v of variants) {
          const after = context(ref.specPath, v.dir, presetsDir);
          await time('check_diff', style, () => checkDiffTool(ctx, { diff: v.diff }));
          const res = await time('check_diff (after-write)', style, () => checkDiffTool(after, { diff: v.diff }));
          for (const f of v.files) {
            const content = fs.readFileSync(path.join(v.dir, f), 'utf8');
            await time('check_file', style, () => checkFileTool(ctx, { path: f, content }));
            await time('which_layer', style, () => whichLayerTool(ctx, { path: f }));
            for (const imp of scanSource(content).imports) await time('check_import', style, () => checkImportTool(ctx, { from: f, module: imp.specifier }));
          }
          for (const file of res.files) {
            for (const finding of file.findings.filter((x) => x.tier === 'blocking')) {
              await time('explain_finding', style, () => explainFindingTool(ctx, { rule: finding.ruleId, location: finding.location }));
              await time('explain_violation', style, () => explainViolationTool(ctx, { rule: finding.ruleId }));
            }
          }
        }
        for (const purpose of ['repository for orders', 'use case to cancel an order', 'controller for invoices']) {
          await time('suggest_placement', style, () => suggestPlacementTool(ctx, { purpose }));
        }
        if (run < inferRuns) await time('infer_spec', style, () => inferSpecTool(ctx, {}));
      }
    }
    if (argv.includes('--stdio')) {
      const entry = path.join(repo, 'dist/mcp-server/main.js');
      if (!fs.existsSync(entry)) throw new Error('--stdio needs the built server: run npm run build');
      for (const { ref, clean, variants } of prepared) {
        const t0 = performance.now();
        const transport = new StdioClientTransport({ command: process.execPath, args: [entry, '--spec', ref.specPath, '--project', clean.projectDir], stderr: 'ignore' });
        const client = new Client({ name: 'mcp-latency', version: '0' });
        await client.connect(transport);
        await client.listTools();
        samples.push({ tool: 'stdio: server start-up to listTools', style: ref.style, ms: performance.now() - t0, cold: false });
        for (let run = 0; run < runs; run++) {
          for (const v of variants) {
            const a = performance.now();
            await client.callTool({ name: 'check_diff', arguments: { diff: v.diff } });
            samples.push({ tool: 'stdio: check_diff', style: ref.style, ms: performance.now() - a, cold: run === 0 && v === variants[0] });
            for (const f of v.files) {
              const content = fs.readFileSync(path.join(v.dir, f), 'utf8');
              const b = performance.now();
              await client.callTool({ name: 'check_file', arguments: { path: f, content } });
              samples.push({ tool: 'stdio: check_file', style: ref.style, ms: performance.now() - b, cold: run === 0 && v === variants[0] && f === v.files[0] });
            }
          }
        }
        await client.close();
      }
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const tools = [...new Set(samples.map((s) => s.tool))];
  const table = tools.map((tool) => {
    const warm = samples.filter((s) => s.tool === tool && !s.cold).map((s) => s.ms);
    const cold = samples.filter((s) => s.tool === tool && s.cold).map((s) => s.ms);
    return {
      tool,
      n: warm.length,
      p50: percentile(warm, 50),
      p95: percentile(warm, 95),
      max: warm.length > 0 ? Math.max(...warm) : Number.NaN,
      coldN: cold.length,
      coldMax: cold.length > 0 ? Math.max(...cold) : Number.NaN,
      allP95: percentile([...warm, ...cold], 95),
    };
  });
  const perStyle = tools.flatMap((tool) =>
    [...new Set(samples.map((s) => s.style))].map((style) => {
      const warm = samples.filter((s) => s.tool === tool && s.style === style && !s.cold).map((s) => s.ms);
      return { tool, style, n: warm.length, p50: percentile(warm, 50), p95: percentile(warm, 95) };
    }),
  );
  const env = { node: process.version, platform: `${os.platform()} ${os.release()}`, cpus: os.cpus().length, cpu: os.cpus()[0]?.model ?? 'unknown', runs, inferRuns };
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'latency.json'), `${JSON.stringify({ env, targetMs: TARGET_MS, table, perStyle }, null, 2)}\n`);
  const f = (x: number): string => (Number.isNaN(x) ? '-' : x.toFixed(1));
  const md = [
    '# MCP v2 latency on the v1.3 reference projects',
    '',
    `Generated by \`scripts/v1.3/mcp-latency.ts\` (${String(runs)} runs; infer_spec ${String(inferRuns)} runs). Node ${env.node}, ${env.platform}, ${String(env.cpus)} x ${env.cpu}. Rows without a prefix: in-process tool handlers with a long-lived server context per project. Rows prefixed \`stdio:\` (with --stdio): the built server (\`dist/mcp-server/main.js\`) driven by an MCP client over stdio, one server process per project. Warm calls; the first call of each tool per project is reported as cold. Target: check_file and check_diff under ${String(TARGET_MS)} ms.`,
    '',
    '| Tool | Warm calls | p50 ms | p95 ms | max ms | Cold calls | Cold max ms | p95 incl. cold ms |',
    '|---|---|---|---|---|---|---|---|',
    ...table.map((r) => `| ${r.tool} | ${String(r.n)} | ${f(r.p50)} | ${f(r.p95)} | ${f(r.max)} | ${String(r.coldN)} | ${f(r.coldMax)} | ${f(r.allP95)} |`),
    '',
    '## Per style (warm)',
    '',
    '| Tool | Style | Calls | p50 ms | p95 ms |',
    '|---|---|---|---|---|',
    ...perStyle.filter((r) => r.n > 0).map((r) => `| ${r.tool} | ${r.style} | ${String(r.n)} | ${f(r.p50)} | ${f(r.p95)} |`),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'latency.md'), md);
  for (const r of table) process.stdout.write(`${r.tool.padEnd(26)} n=${String(r.n).padEnd(5)} p50=${f(r.p50).padStart(8)} p95=${f(r.p95).padStart(8)} max=${f(r.max).padStart(8)} cold-max=${f(r.coldMax).padStart(8)}\n`);
  const slow = table.filter((r) => /(^|: )check_(file|diff)/.test(r.tool) && !(r.allP95 < TARGET_MS));
  process.stdout.write(`wrote ${path.relative(repo, outDir)}/latency.{json,md}; check_file/check_diff over target: ${slow.map((r) => r.tool).join(', ') || 'none'}\n`);
  return argv.includes('--check') && slow.length > 0 ? 1 : 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
