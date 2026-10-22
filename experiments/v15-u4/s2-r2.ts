/**
 * U4 S2 revision r2 (v1.5-exp, note §8 r2): the one fix after the r1 failure, POST-HOC development evidence only.
 * The D5 rule text's exemption sentence is replaced (set invariants need an owning aggregate); nothing else in the
 * `detect02-sem-v1` question changes. Asked once on the 9 candidates the note names; same ledger, cap and cassettes.
 *
 *   npx tsx experiments/v15-u4/s2-r2.ts --pilot-trees <dir> --estimate | --record | --replay   # → results/s2-r2-answers.json
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { FAMILY_RULE, grounding, promptOf, PROMPT_VERSION as SEM_VERSION, SYSTEM } from '../detect-02/semantic.js';
import { resolveTree } from './candidates.js';
import type { U4Candidate } from './candidates.js';
import { ask, HARD_CAP, LEDGER, ledgerCount } from './llm.js';
import type { Budget, Mode } from './llm.js';
import { S2_SCHEMA, s2Problem } from './s2.js';

const HERE = 'experiments/v15-u4';
export const R2_VERSION = `${SEM_VERSION}+u4-r2`;
const OLD = 'Pure input parsing (types, formats, required fields) and cross-aggregate checks such as uniqueness are not violations.';
const NEW = 'Pure input parsing (types, formats, required fields) is not a violation, and neither is uniqueness of a key across the whole store. A rule over a set of instances that must hold at every commit (for example: no two active bookings of one room overlap) is an invariant that needs an owning aggregate. If no aggregate owns that set and a service checks it, with or without a lock, the rule is broken, even when the service calls a domain helper to compute it.';
export const R2_ITEMS = [
  'pilot/s1-hotel-bookings/step-01#D5#src/application/services/BookRoomService.ts:54',
  'pilot/s1-hotel-bookings/step-02#D5#src/application/services/BookRoomService.ts:84',
  'pilot/s1-hotel-bookings/step-03#D5#src/application/services/BookRoomService.ts:85',
  'pilot/s1-hotel-bookings/step-04#D5#src/application/services/BookRoomService.ts:85',
  'pilot/s1-hotel-bookings/step-05#D5#src/application/services/BookRoomService.ts:74',
  'pilot/s2-orders-invoices/step-00#D5#src/ordering/application/PlaceOrder.ts:22',
  'fixture/c1-s1-d5-lock/pos#D5#src/application/services/BookRoomService.ts:14',
  'precision/p10-shared-kernel-types/legit/declared#D5#src/sales/application/PlaceOrder.ts:12',
  'puzzle/p1-transfers/c10/step-01#D5#src/ledger/application/Transfer.ts:15',
];

async function main(argv: readonly string[]): Promise<number> {
  const arg = (k: string): string | undefined => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const pilot = arg('pilot-trees');
  if (pilot === undefined) { process.stderr.write('--pilot-trees <dir>\n'); return 2; }
  const mode: Mode = argv.includes('--record') ? 'record' : argv.includes('--replay') ? 'replay' : 'estimate';
  if (!FAMILY_RULE['D5']!.includes(OLD)) throw new Error('the D5 rule text changed; r2 cannot be applied');
  const all = JSON.parse(fs.readFileSync(path.join(HERE, 'results', 'candidates.json'), 'utf8')) as U4Candidate[];
  const usedBefore = fs.readFileSync(LEDGER, 'utf8').split('\n').filter((l) => l.includes('"part":"S2"')).length;
  // r2 is bounded by the hard cap only (the r1 S2 part cap of 52 covered r1; 47 were used).
  const budget: Budget = { mode, partCap: HARD_CAP, used: usedBefore, stopped: null };
  const rows: Record<string, unknown>[] = [];
  for (const id of R2_ITEMS) {
    const c = all.find((x) => x.id === id);
    if (c === undefined) throw new Error(`no candidate ${id}`);
    const rc = { ...c, tree: resolveTree(c.tree, pilot) };
    const { prompt: p0, files } = promptOf(rc);
    const prompt = p0.replace(OLD, NEW);
    if (prompt === p0) throw new Error('rule text not replaced');
    const res = await ask({ part: 'S2', item: `r2:${id}`, run: 0, promptVersion: R2_VERSION, system: SYSTEM, schema: S2_SCHEMA, prompt, check: s2Problem }, budget);
    if (mode === 'estimate') { process.stdout.write(`${id}${res.cached ? ' (cassette)' : ''}\n`); continue; }
    const a = res.answer as { verdict: string; evidence: { file: string; line: number; quote: string }[]; rationale: string } | null;
    const g = a !== null && res.invalid === null ? grounding(rc.tree, files, a as never) : { cited: 0, grounded: 0 };
    const verdict = a === null || res.invalid !== null ? 'invalid' : a.verdict;
    rows.push({ id, label: c.label, expected: c.expected, verdict, grounded: verdict !== 'confirm' || (g.cited > 0 && g.grounded === g.cited), cached: res.cached, key: res.key.slice(0, 24), rationale: a?.rationale ?? null });
    process.stdout.write(`${id} [${String(c.expected)}]: ${verdict}\n`);
  }
  if (mode === 'estimate') { process.stdout.write(`ledger ${String(ledgerCount())} of ${String(HARD_CAP)}\n`); return 0; }
  fs.writeFileSync(path.join(HERE, 'results', 's2-r2-answers.json'), `${JSON.stringify({ schema: 'v15-u4-s2-r2-v1', promptVersion: R2_VERSION, posthoc: true, ruleTextD5: FAMILY_RULE['D5']!.replace(OLD, NEW), rows }, null, 1)}\n`);
  process.stdout.write(`r2 done; ledger ${String(ledgerCount())} of ${String(HARD_CAP)}${budget.stopped !== null ? `; STOPPED: ${budget.stopped}` : ''}\n`);
  return budget.stopped !== null ? 4 : 0;
}

if (process.argv[1]?.endsWith('s2-r2.ts')) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e: unknown) => { process.stderr.write(`${String(e instanceof Error ? e.stack : e)}\n`); process.exitCode = 1; });
}
