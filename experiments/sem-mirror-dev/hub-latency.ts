/**
 * R-MIRROR-SEM added latency per push in the delivery hub (development measurement). One Hexagonal cell, seed = the
 * synthetic `parcel-coarse` tree; the agent's edits are simulated: (1) the mirrored set of `parcel-mirror` arrives (a
 * new candidate: one model call), (2) an unrelated edit (the candidate is unchanged: the session map answers), (3) a
 * second unrelated edit. The same three pushes run in a control cell with no judge (R-MIRROR-SEM silent, zero calls);
 * the added latency is the difference of the hub's own `checkMs` per push. A fresh empty disk cache is used, so the
 * first push really calls (`claude-opus-5-5`, the Claude CLI judge route).
 *
 *   npx tsx experiments/sem-mirror-dev/hub-latency.ts [--out experiments/sem-mirror-dev/results/hub-latency.json]
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DeliveryHub } from '../../src/v15-instrument/delivery/hub.js';
import { cliCaller, createMirrorJudge } from '../../src/v15-instrument/mirror-sem.js';

const CASES = path.join('experiments', 'sem-mirror-dev', 'cases');
const argOf = (k: string): string | undefined => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };

async function cell(name: string, judged: boolean, tmp: string): Promise<Record<string, unknown>[]> {
  const cache = path.join(tmp, `cache-${name}`);
  const hub = new DeliveryHub(path.join(tmp, 'sock', `${name}.sock`), null, path.join(tmp, `logs-${name}`), {
    mirrorJudge: judged ? (ledger) => createMirrorJudge({ mode: 'live', cacheDir: cache, caller: cliCaller(), ledger }) : () => null,
  });
  await hub.start();
  const work = path.join(tmp, `work-${name}`);
  fs.cpSync(path.join(CASES, 'parcel-coarse', 'tree'), work, { recursive: true });
  const post = (file: string): string => JSON.stringify({ session_id: 's', cwd: work, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.resolve(work, file), content: 'x' } });
  try {
    await hub.setCell({ id: name, session: null, step: 's1', turn: 't1', spec: path.join(CASES, 'parcel-coarse', 'spec.yaml'), project: path.resolve(work), baseline: path.resolve(CASES, 'parcel-coarse', 'tree') });
    fs.cpSync(path.join(CASES, 'parcel-mirror', 'tree'), work, { recursive: true });
    await hub.handleHook(post('src/domain/parcel.ts'));
    for (const n of [1, 2]) {
      fs.appendFileSync(path.join(work, 'src/application/update-customer.use-case.ts'), `\n// unrelated edit ${String(n)}\n`);
      await hub.handleHook(post('src/application/update-customer.use-case.ts'));
    }
  } finally {
    await hub.stop();
  }
  return fs.readFileSync(path.join(tmp, `logs-${name}`, `${name}.push.jsonl`), 'utf8').trim().split('\n').map((l) => {
    const x = JSON.parse(l) as Record<string, unknown>;
    return { seq: x['seq'], file: x['file'], checkMs: x['checkMs'], ms: x['ms'], findings: x['findings'], mirrorSem: x['mirrorSem'] ?? null };
  });
}

async function main(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-mirror-latency-'));
  const control = await cell('control', false, tmp);
  const judged = await cell('judged', true, tmp);
  fs.rmSync(tmp, { recursive: true, force: true });
  const added = judged.map((j, i) => Number(j['checkMs']) - Number(control[i]?.['checkMs'] ?? 0));
  const out = { pushes: ['mirrored set arrives (new candidate)', 'unrelated edit 1 (unchanged candidate)', 'unrelated edit 2 (unchanged candidate)'], control, judged, addedCheckMs: added };
  process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  const f = argOf('--out');
  if (f !== undefined) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, `${JSON.stringify(out, null, 2)}\n`); }
}
void main();
