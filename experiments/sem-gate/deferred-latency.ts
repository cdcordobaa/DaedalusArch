/**
 * SEM-GATE criterion 4: the delivery hub's push-check latency with R-MIRROR-SEM in deferred mode (`deferredJudge`, the
 * mode `DAEDALUS_MIRROR_SEM=deferred` selects), against a control cell with no judge. Adapted from
 * `experiments/sem-mirror-dev/hub-latency.ts`. One Hexagonal cell per arm; the seed is the hxpb1 clean tree
 * (`cases/hxpb1-n1`, baseline: the task seed); pushes:
 *   1. the renamed copy of `cases/hxpb1-b2` arrives (a new candidate: the deferred judge starts one call in the
 *      background and answers pending);
 *   2..20. nineteen unrelated edits (the candidate is unchanged);
 *   then the hub settles the judge (waits for the call in flight), and
 *   21. one more unrelated edit: the answer is in, so R-MIRROR-SEM fires on this check.
 * A fresh empty disk cache is used, so the background call is real (`claude-opus-5-5`, the Claude CLI judge route);
 * every call goes to `results/latency-calls.jsonl`.
 *
 *   npx tsx experiments/sem-gate/deferred-latency.ts --out experiments/sem-gate/results/deferred-latency.json
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DeliveryHub } from '../../src/v15-instrument/delivery/hub.js';
import { cliCaller, createMirrorJudge, deferredJudge } from '../../src/v15-instrument/mirror-sem.js';

const HERE = path.join('experiments', 'sem-gate');
const CASES = path.join(HERE, 'cases');
const TASK = path.join('experiments', 'hx-study-set', 'part-b', 'hxpb1-pottery-kiln');
const LEDGER = path.join(HERE, 'results', 'latency-calls.jsonl');
const UNRELATED = 'src/domain/services/FiringRules.ts';
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };

async function cell(name: string, judged: boolean, tmp: string): Promise<Record<string, unknown>[]> {
  const cache = path.join(tmp, `cache-${name}`);
  const hub = new DeliveryHub(path.join(tmp, 'sock', `${name}.sock`), null, path.join(tmp, `logs-${name}`), {
    mirrorJudge: judged ? () => deferredJudge(createMirrorJudge({ mode: 'live', cacheDir: cache, caller: cliCaller(), ledger: path.resolve(LEDGER) })) : () => null,
  });
  await hub.start();
  const work = path.join(tmp, `work-${name}`);
  fs.cpSync(path.join(CASES, 'hxpb1-n1', 'tree'), work, { recursive: true });
  const post = (file: string): string => JSON.stringify({ session_id: 's', cwd: work, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.resolve(work, file), content: 'x' } });
  const edit = async (n: number): Promise<void> => {
    fs.appendFileSync(path.join(work, UNRELATED), `\n// unrelated edit ${String(n)}\n`);
    await hub.handleHook(post(UNRELATED));
  };
  try {
    await hub.setCell({ id: name, session: null, step: 's1', turn: 't1', spec: path.join(TASK, 'spec.yaml'), project: path.resolve(work), baseline: path.resolve(TASK, 'seed') });
    fs.cpSync(path.join(CASES, 'hxpb1-b2', 'tree'), work, { recursive: true });
    await hub.handleHook(post('src/domain/model/FiringProgress.ts'));
    for (let n = 1; n <= 19; n++) await edit(n);
    await hub.settleJudge();
    await edit(20);
  } finally {
    await hub.stop();
  }
  return fs.readFileSync(path.join(tmp, `logs-${name}`, `${name}.push.jsonl`), 'utf8').trim().split('\n').map((l) => {
    const x = JSON.parse(l) as Record<string, unknown>;
    return { seq: x['seq'], file: x['file'], checkMs: x['checkMs'], ms: x['ms'], findings: x['findings'], mirrorSem: x['mirrorSem'] ?? null };
  });
}

const p95 = (xs: readonly number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil(0.95 * s.length) - 1)]!; };

async function main(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-gate-latency-'));
  const before = fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter((l) => l !== '').length : 0;
  const control = await cell('control', false, tmp);
  const deferred = await cell('deferred', true, tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
  const calls = fs.existsSync(LEDGER) ? fs.readFileSync(LEDGER, 'utf8').trim().split('\n').filter((l) => l !== '').slice(before).map((l) => JSON.parse(l) as { durationMs: number; ok: boolean }) : [];
  const ck = (xs: Record<string, unknown>[]): number[] => xs.map((x) => Number(x['checkMs']));
  const added = ck(deferred).map((v, i) => v - (ck(control)[i] ?? 0));
  const n = deferred.length;
  const fd = (xs: Record<string, unknown>[], i: number): number => Number(xs[i]?.['findings'] ?? 0);
  const summary = {
    pushes: n, controlPushes: control.length, calls: calls.length, callsOk: calls.filter((c) => c.ok).length,
    minCallMs: calls.length > 0 ? Math.min(...calls.map((c) => c.durationMs)) : null,
    p95CheckMs: p95(ck(deferred)), maxCheckMs: Math.max(...ck(deferred)), controlP95CheckMs: p95(ck(control)),
    maxAddedMs: Math.max(...added),
    // the last push follows the settle: the deferred cell gains the R-MIRROR-SEM finding there, the control cell does not
    firedAfterSettle: fd(deferred, n - 1) > fd(deferred, n - 2) && fd(control, n - 1) === fd(control, n - 2),
  };
  const out = { summary, addedCheckMs: added, control, deferred };
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  const f = argOf('--out');
  if (f !== undefined) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(out, null, 1)}\n`); }
}
void main();
