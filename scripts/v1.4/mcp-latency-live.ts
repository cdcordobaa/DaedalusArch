/**
 * Gate line D5 (MCP latency in the live loop) from stored call logs. Entry file: no exports. Zero model calls.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.4/mcp-latency-live.ts --out-root <mcp out-root> [--out-root ...] --out <report.json>
 *
 * For every `daedalus-mcp` step turn with a call log (`<run>/calls/<step>.jsonl`, schema `mcp-call/v1`; inherited
 * shared-start step-1 records have none and are skipped), it reads each call's server-side `durationMs` and the turn's
 * `wallMs`. The registered bar (readiness gate D5): p95 per call ≤ 1 s, and total tool time ≤ 5 % of the step's wall
 * time, on every step. Exit 0 when the bar holds, 1 when it fails, 2 on an error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const P95_BAR_MS = 1000;
const SHARE_BAR = 0.05;

function args(name: string): string[] {
  const out: string[] = [];
  process.argv.forEach((a, i) => {
    if (a === `--${name}` && process.argv[i + 1] !== undefined) out.push(process.argv[i + 1] as string);
  });
  return out;
}

function quantile(xs: readonly number[], q: number): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)] ?? null;
}

function runDirs(root: string): string[] {
  const out: string[] = [];
  const rec = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || ['work', 'snapshots.git', 'node_modules', 'turns', 'steps', 'calls'].includes(e.name)) continue;
      const p = path.join(d, e.name);
      if (fs.existsSync(path.join(p, 'run.json'))) out.push(p);
      else rec(p);
    }
  };
  rec(path.join(root, 'runs'));
  return out.sort();
}

function main(): number {
  const roots = args('out-root').map((r) => path.resolve(r));
  const outFile = args('out')[0];
  if (roots.length === 0 || outFile === undefined) throw new Error('usage: --out-root <dir> [...] --out <report.json>');
  const calls: { tool: string; ms: number }[] = [];
  const steps: { root: number; run: string; step: string; calls: number; toolMs: number; wallMs: number; share: number }[] = [];
  roots.forEach((root, ri) => {
    for (const rd of runDirs(root)) {
      const run = path.relative(path.join(root, 'runs'), rd).split(path.sep).join('/');
      const stepsDir = path.join(rd, 'steps');
      for (const sf of fs.readdirSync(stepsDir).filter((f) => /^step-\d\d\.json$/.test(f)).sort()) {
        const rec = JSON.parse(fs.readFileSync(path.join(stepsDir, sf), 'utf8')) as { process?: { logs?: string[] } | null; turns: { result?: { wallMs?: number } }[] };
        const logs = rec.process?.logs ?? [];
        if (logs.length === 0) continue;
        let n = 0;
        let toolMs = 0;
        for (const l of logs) {
          for (const line of fs.readFileSync(path.join(rd, l), 'utf8').split('\n').filter((x) => x.trim() !== '')) {
            const c = JSON.parse(line) as { tool: string; durationMs: number };
            calls.push({ tool: c.tool, ms: c.durationMs });
            n += 1;
            toolMs += c.durationMs;
          }
        }
        const wallMs = rec.turns.reduce((a, t) => a + (t.result?.wallMs ?? 0), 0);
        steps.push({ root: ri, run, step: sf.replace('.json', ''), calls: n, toolMs, wallMs, share: wallMs > 0 ? toolMs / wallMs : Number.NaN });
      }
    }
  });
  const all = calls.map((c) => c.ms);
  const byTool = Object.fromEntries([...new Set(calls.map((c) => c.tool))].sort().map((t) => {
    const xs = calls.filter((c) => c.tool === t).map((c) => c.ms);
    return [t, { calls: xs.length, p50: quantile(xs, 0.5), p95: quantile(xs, 0.95), max: Math.max(...xs) }];
  }));
  const p95 = quantile(all, 0.95);
  const maxShare = Math.max(...steps.map((s) => s.share));
  const stepsOver = steps.filter((s) => !(s.share <= SHARE_BAR)).length;
  const pass = p95 !== null && p95 <= P95_BAR_MS && stepsOver === 0 && steps.length > 0;
  const report = {
    schema: 'study2b-mcp-latency-live/v1', bar: { p95PerCallMs: P95_BAR_MS, toolShareOfStepWall: SHARE_BAR },
    outRoots: roots.length, steps: steps.length, calls: calls.length,
    perCall: { p50: quantile(all, 0.5), p95, max: all.length > 0 ? Math.max(...all) : null }, byTool,
    toolShare: { max: maxShare, median: quantile(steps.map((s) => s.share), 0.5), stepsOverBar: stepsOver },
    pass, stepRows: steps,
  };
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(path.resolve(outFile), `${JSON.stringify(report, null, 1)}\n`);
  process.stdout.write(`steps ${String(steps.length)}, calls ${String(calls.length)}; per call p50 ${String(report.perCall.p50)} ms, p95 ${String(p95)} ms, max ${String(report.perCall.max)} ms (bar p95 <= ${String(P95_BAR_MS)} ms)\n`);
  for (const [t, s] of Object.entries(byTool)) process.stdout.write(`  ${t}: ${String(s.calls)} calls, p50 ${String(s.p50)} ms, p95 ${String(s.p95)} ms, max ${String(s.max)} ms\n`);
  process.stdout.write(`tool time / step wall: max ${(maxShare * 100).toFixed(3)} %, median ${((report.toolShare.median ?? 0) * 100).toFixed(3)} %; steps over ${String(SHARE_BAR * 100)} %: ${String(stepsOver)}\n`);
  process.stdout.write(`D5 bar: ${pass ? 'PASS' : 'FAIL'}\n`);
  return pass ? 0 : 1;
}

try {
  process.exitCode = main();
} catch (e) {
  process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
}
