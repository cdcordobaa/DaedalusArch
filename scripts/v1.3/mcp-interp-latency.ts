/**
 * Latency of check_diff and check_file with `--fast-rules-engine cypher-interp` (Docs/v1.3/mcp-interp-parity.md §4.5)
 * on the largest v1.3 reference variant (most source lines), against the fast path. Each tool is called `--reps`
 * times: `cold` (a fresh evaluator: both project states evaluated), `new-proposal` (one evaluator, the before state
 * cached, every call a different proposal: one evaluation, the agent's usual case) and `repeat` (the identical call
 * again: both states cached). Entry file.
 *
 *   npx tsx scripts/v1.3/mcp-interp-latency.ts [--reps 10] [--out <dir>]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadAllReferences } from './lib/reference-model.js';
import { makeTempRoot, materialiseVariant } from './lib/materialise.js';
import { percentile, projectDiff } from './lib/mcp-consistency.js';
import { checkDiffTool, checkFileTool, createSpecLoader } from '../../src/mcp-server/tools.js';
import type { ServerContext } from '../../src/mcp-server/tools.js';
import { InterpEvaluator } from '../../src/mcp-server/interp-check.js';
import { parseUnifiedDiff } from '../../src/mcp-server/diff-check.js';

function sourceLines(dir: string): number {
  let n = 0;
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) walk(abs);
      else if (/\.ts$/.test(e.name)) n += fs.readFileSync(abs, 'utf8').split('\n').length;
    }
  };
  walk(dir);
  return n;
}

function ctx(specPath: string, root: string, interp: InterpEvaluator | undefined): ServerContext {
  const refuse = (): never => {
    throw new Error('not used');
  };
  return {
    defaultSpecPath: specPath,
    defaultProjectPath: root,
    env: {},
    loadSpec: createSpecLoader(),
    evaluateDeps: { makeGraph: refuse, makePipeline: refuse },
    ...(interp !== undefined && { fastRulesEngine: 'cypher-interp' as const, interp }),
  };
}

async function time(f: () => Promise<{ ok: boolean }>): Promise<number> {
  const t0 = performance.now();
  const r = await f();
  if (!r.ok) throw new Error('tool call failed');
  return performance.now() - t0;
}

async function main(argv: readonly string[]): Promise<void> {
  const repo = process.cwd();
  const repsIdx = argv.indexOf('--reps');
  const reps = repsIdx >= 0 ? Number(argv[repsIdx + 1]) : 10;
  const outIdx = argv.indexOf('--out');
  const outDir = outIdx >= 0 ? path.resolve(repo, argv[outIdx + 1] ?? '') : undefined;
  const tmp = makeTempRoot('mcp-interp-latency-');
  try {
    let best: { style: string; variant: string; loc: number; specPath: string; clean: string; dir: string } | undefined;
    for (const ref of loadAllReferences(repo)) {
      const cleanV = ref.variants.find((v) => v.manifest.variant === 'clean');
      if (cleanV === undefined) continue;
      const clean = materialiseVariant(ref, cleanV, path.join(tmp, 'clean')).projectDir;
      for (const v of ref.variants) {
        if (v.manifest.variant === 'clean') continue;
        const m = materialiseVariant(ref, v, path.join(tmp, 'variants'));
        const loc = sourceLines(m.projectDir);
        if (best === undefined || loc > best.loc) best = { style: ref.style, variant: v.manifest.variant, loc, specPath: ref.specPath, clean, dir: m.projectDir };
      }
    }
    if (best === undefined) throw new Error('no reference variant');
    const diff = projectDiff(best.clean, best.dir);
    const first = parseUnifiedDiff(diff).find((f) => f.newPath !== null && /\.ts$/.test(f.newPath));
    if (first?.newPath == null) throw new Error('the variant diff has no .ts file');
    const filePath = first.newPath;
    const content = fs.readFileSync(path.join(best.dir, filePath), 'utf8');
    const rows: { tool: string; engine: string; cache: string; p50: number; p95: number; n: number }[] = [];
    const run = async (tool: string, engine: string, cache: string, call: (c: ServerContext, i: number) => Promise<{ ok: boolean }>): Promise<void> => {
      const shared = engine === 'cypher-interp' ? new InterpEvaluator() : undefined;
      if (cache !== 'cold' && shared !== undefined) await call(ctx(best.specPath, best.clean, shared), -1);
      const ms: number[] = [];
      for (let i = 0; i < reps; i++) {
        const interp = engine === 'cypher-interp' ? (cache === 'cold' ? new InterpEvaluator() : shared) : undefined;
        ms.push(await time(() => call(ctx(best.specPath, best.clean, interp), cache === 'new-proposal' ? i : -1)));
      }
      rows.push({ tool, engine, cache, p50: percentile(ms, 50), p95: percentile(ms, 95), n: ms.length });
    };
    // A new proposal: one more comment line (a different after state, the same before state).
    const extra = (i: number): string => (i < 0 ? '' : `// proposal ${String(i)}\n`);
    const extraDiff = (i: number): string => (i < 0 ? '' : `diff --git a/src/latency-probe-${String(i)}.ts b/src/latency-probe-${String(i)}.ts\nnew file mode 100644\n--- /dev/null\n+++ b/src/latency-probe-${String(i)}.ts\n@@ -0,0 +1 @@\n+export const probe${String(i)} = ${String(i)};\n`);
    for (const engine of ['fast', 'cypher-interp']) {
      for (const cache of engine === 'fast' ? ['n/a'] : ['cold', 'new-proposal', 'repeat']) {
        await run('check_diff', engine, cache, (c, i) => checkDiffTool(c, { diff: `${diff}${extraDiff(i)}` }));
        await run('check_file', engine, cache, (c, i) => checkFileTool(c, { path: filePath, content: `${content}${extra(i)}` }));
      }
    }
    const md = [
      `# check_diff / check_file latency, ${best.style}/${best.variant} (${String(best.loc)} source lines; before-write: project root = clean)`,
      '',
      `Generated by \`scripts/v1.3/mcp-interp-latency.ts\` (${String(reps)} calls per row; ms, nearest-rank percentiles; one machine, development set).`,
      '',
      '| Tool | Engine | Cache | p50 ms | p95 ms | n |',
      '|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.tool} | ${r.engine} | ${r.cache} | ${r.p50.toFixed(0)} | ${r.p95.toFixed(0)} | ${String(r.n)} |`),
      '',
    ].join('\n');
    process.stdout.write(md);
    if (outDir !== undefined) {
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(path.join(outDir, 'latency.md'), md);
      fs.writeFileSync(path.join(outDir, 'latency.json'), `${JSON.stringify({ style: best.style, variant: best.variant, loc: best.loc, reps, rows }, null, 2)}\n`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main(process.argv.slice(2)).catch((e: unknown) => {
  process.stderr.write(`${e instanceof Error ? e.stack ?? e.message : String(e)}\n`);
  process.exitCode = 2;
});
