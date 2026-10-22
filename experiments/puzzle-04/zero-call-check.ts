/**
 * PUZZLE-04 zero-call check of the extended gate hub (layers on) and of the pull arm's frozen check_file, on the
 * baseline agents' trees (development evidence: these trees are the baselines', never a generator's input here).
 *
 *   npx tsx experiments/puzzle-04/zero-call-check.ts [--out experiments/puzzle-04/zero-call/hub-baseline-trees.json]
 *
 * Gate: for every scored baseline session of P1 and P2 (PUZZLE-01 baseline) and of P3r, P5 and P6 (PUZZLE-03
 * baseline), a hub cell opens on the session's own seed snapshot (`step-00`); each step snapshot then replaces the
 * tree, one PostToolUse event is sent for a changed file, and a Stop event closes the session. Recorded per step: the
 * keys the hub would show, the keys open, and the hub time.
 * Pull: the frozen `check_file` (fast path, as the pull arm's server answers it) on the final tree's P6 controller.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { buildContext, parseArgs } from '../../src/mcp-server/context.js';
import { checkFileTool } from '../../src/mcp-server/tools.js';
import { checkConsistency } from '../detect-02/mcp/consistency.js';
import { GateHub, type GateLogLine } from '../edit-gate/hub.js';

const REPO = process.cwd();
const BASE: Record<string, { results: string; spec: string }> = {
  'p1-transfers': { results: 'results/v1.4-puzzle-01-baseline', spec: 'experiments/puzzle-01/puzzles/p1-transfers/spec.yaml' },
  'p2-loyalty': { results: 'results/v1.4-puzzle-01-baseline', spec: 'experiments/puzzle-01/puzzles/p2-loyalty/spec.yaml' },
  'p3r-shipping-quotes': { results: 'results/v1.4-puzzle-03-baseline', spec: 'experiments/puzzle-03/puzzles/p3r-shipping-quotes/spec.yaml' },
  'p5-ferry-seats': { results: 'results/v1.4-puzzle-03-baseline', spec: 'experiments/puzzle-03/puzzles/p5-ferry-seats/spec.yaml' },
  'p6-workshop-jobs': { results: 'results/v1.4-puzzle-03-baseline', spec: 'experiments/puzzle-03/puzzles/p6-workshop-jobs/spec.yaml' },
};

function replaceTree(from: string, to: string): void {
  for (const e of fs.readdirSync(to)) if (e !== 'node_modules') fs.rmSync(path.join(to, e), { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
}

function firstChanged(a: string, b: string): string | null {
  const walk = (d: string, r = ''): string[] => fs.readdirSync(path.join(d, r), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(d, path.join(r, e.name)) : [path.join(r, e.name)]));
  const A = new Set(walk(a));
  for (const f of walk(b).sort()) if (!A.has(f) || !fs.readFileSync(path.join(a, f)).equals(fs.readFileSync(path.join(b, f)))) return f;
  return null;
}

async function main(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p04-zero-'));
  const hub = new GateHub(path.join(tmp, 'g.sock'), path.join(tmp, 'log'), checkConsistency, { layers: true });
  await hub.start();
  const sessions: Record<string, unknown>[] = [];
  const ms: number[] = [];
  for (const [puzzle, b] of Object.entries(BASE)) {
    const map = JSON.parse(fs.readFileSync(path.join(REPO, b.results, 'private-id-map.json'), 'utf8')) as { sessions: Record<string, { puzzle: string; verdict: string }> };
    for (const [id, s] of Object.entries(map.sessions)) {
      if (s.puzzle !== puzzle || s.verdict !== 'done') continue;
      const snap = path.join(REPO, b.results, 'sessions', id, 'snap');
      const w = path.join(tmp, 'w', id + puzzle.slice(0, 3));
      fs.mkdirSync(w, { recursive: true });
      replaceTree(path.join(snap, 'step-00'), w);
      const cellId = `${puzzle}-${id}`;
      await hub.setCell({ id: cellId, turn: 'step-01', spec: path.join(REPO, b.spec), project: w });
      const steps: Record<string, unknown>[] = [];
      let prev = path.join(snap, 'step-00');
      for (const step of ['step-01', 'step-02', 'step-03']) {
        const dir = path.join(snap, step);
        if (!fs.existsSync(dir)) break;
        hub.setTurn(step);
        replaceTree(dir, w);
        const f = firstChanged(prev, dir) ?? firstChanged(path.join(snap, 'step-00'), dir);
        prev = dir;
        if (f === null) {
          steps.push({ step, changed: false });
          continue;
        }
        await hub.handle(JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.join(w, f) } }));
        const last = JSON.parse(fs.readFileSync(hub.logFile(cellId), 'utf8').trim().split('\n').pop() as string) as GateLogLine;
        ms.push(last.ms);
        steps.push({ step, newKeys: last.newKeys, openKeys: last.openKeys, ms: last.ms, layerMs: last.layerMs ?? null, failOpen: last.failOpen, error: last.error });
      }
      await hub.handle(JSON.stringify({ hook_event_name: 'Stop', stop_hook_active: false }));
      const stop = JSON.parse(fs.readFileSync(hub.logFile(cellId), 'utf8').trim().split('\n').pop() as string) as GateLogLine;
      hub.clear();
      const finalOpen = stop.openKeys;
      let pull: unknown = null;
      if (puzzle === 'p6-workshop-jobs') {
        const ctrl = 'src/presentation/ReportsController.ts';
        const ctx = buildContext(parseArgs(['--spec', path.join(REPO, b.spec), '--project', w, '--engine', 'cypher-interp']), {});
        const r = await checkFileTool(ctx, { path: ctrl, content: fs.readFileSync(path.join(w, ctrl), 'utf8') });
        pull = r.ok ? r.data.findings.filter((v) => v.ruleId === 'FF-S03').map((v) => `${v.tier} ${v.location} ${v.target ?? ''}`) : r.message;
      }
      sessions.push({ puzzle, session: id, steps, stopBlock: stop.stopBlock, finalOpen, gateFlagsFinal: finalOpen.length > 0, consistencyOpen: finalOpen.filter((k) => k.startsWith('R-')).length, layerOpen: finalOpen.filter((k) => k.startsWith('FF-S0')).length, pullCheckFileFfS03: pull });
    }
  }
  await hub.stop();
  fs.rmSync(tmp, { recursive: true, force: true });
  const s = [...ms].sort((a, b) => a - b);
  const pct = (p: number): number => s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)] ?? NaN;
  const summary = Object.fromEntries(Object.keys(BASE).map((p) => {
    const xs = sessions.filter((x) => x.puzzle === p) as { gateFlagsFinal: boolean; consistencyOpen: number; layerOpen: number }[];
    return [p, { finalTrees: xs.length, flagged: xs.filter((x) => x.gateFlagsFinal).length, byConsistency: xs.filter((x) => x.consistencyOpen > 0).length, byLayers: xs.filter((x) => x.layerOpen > 0).length }];
  }));
  const out = { schema: 'puzzle-04-zero-call/v1', at: new Date().toISOString(), calls: 0, latencyMs: { n: s.length, p50: pct(50), p95: pct(95), max: s[s.length - 1] }, summary, sessions };
  const i = process.argv.indexOf('--out');
  if (i >= 0) {
    fs.mkdirSync(path.dirname(path.resolve(process.argv[i + 1] as string)), { recursive: true });
    fs.writeFileSync(path.resolve(process.argv[i + 1] as string), `${JSON.stringify(out, null, 1)}\n`);
  }
  process.stdout.write(`${JSON.stringify({ latencyMs: out.latencyMs, summary }, null, 2)}\n`);
}

void main();
