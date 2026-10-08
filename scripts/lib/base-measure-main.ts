/**
 * `main` of `scripts/u5a-base-measure.ts`: Build and Test entry for the catalogue-freeze measurements on prepared
 * corpus bases (BR-U5a-36 b, c; BR-U5a-37; U5a code summary §9 item 7; Build and Test Steps 18–19).
 *
 * Usage (repository root):
 *   npx tsx scripts/u5a-base-measure.ts typecheck   --bases <list.json> --out <dir> [--scratch <dir>]
 *   npx tsx scripts/u5a-base-measure.ts feasibility --bases <list.json> --out <dir> [--scratch <dir>] [--split held-out|dev]
 *
 * `<list.json>` is a JSON array of `PreparedBase` objects (`prepare-bases-cli.ts --out`), validated by
 * `makePreparedBase`. `typecheck` runs `measureBaseTypecheck` and writes `u5a-base-typecheck.{json,md}`.
 * `feasibility` runs `siteFeasibility` with `CATALOGUE_OPERATORS` (SP probes are never passed in), every base under
 * one split (default `held-out`), then `chooseSitesPerOperator` with `MASTER_SEED`, and writes
 * `u5a-site-feasibility.{json,md}`. The rule is applied as registered: a `CAT_SHORTFALL` is written to the table and
 * exits 1; no k is chosen by this entry. Bases are only read (analysis copies under `--scratch`, default the OS
 * temporary directory). Exit 0 ok (feasibility: a k was chosen); 1 `CAT_SHORTFALL` or any base excluded by type
 * errors; 2 usage, input or measurement error.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { ProcessRunner } from '../../src/shared/interfaces/process-runner.js';
import { NodeProcessRunner } from '../../src/shared/process/node-process-runner.js';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { knownSecrets } from './manifest.js';
import {
  chooseSitesPerOperator, heldOutTotals, measureBaseTypecheck, siteFeasibility, writeBaseTypecheckTable,
  writeSiteFeasibilityTable,
} from './mutation/freeze-gates.js';
import type { FeasibilitySplit } from './mutation/freeze-gates.js';
import { CATALOGUE_OPERATORS, MASTER_SEED } from './mutation/operators/index.js';
import { makePreparedBase } from './mutation/prepare.js';
import type { PreparedBaseInput } from './mutation/prepare.js';
import type { PreparedBase } from './mutation/types.js';

export const BASE_MEASURE_USAGE = [
  'usage: npx tsx scripts/u5a-base-measure.ts typecheck   --bases <list.json> --out <dir> [--scratch <dir>]',
  '       npx tsx scripts/u5a-base-measure.ts feasibility --bases <list.json> --out <dir> [--scratch <dir>] [--split held-out|dev]',
  '',
  'Catalogue-freeze measurements on prepared bases (BR-U5a-36 b, c; BR-U5a-37).',
  'Exit 0 ok; 1 CAT_SHORTFALL or an excluded base; 2 usage, input or measurement error.',
  '',
].join('\n');

export interface BaseMeasureDeps {
  readonly runner: ProcessRunner;
  readonly now: () => Date;
  readonly out: (text: string) => void;
  readonly err: (text: string) => void;
}

export function defaultBaseMeasureDeps(): BaseMeasureDeps {
  return { runner: new NodeProcessRunner(), now: () => new Date(), out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) };
}

interface Args {
  readonly gate: 'typecheck' | 'feasibility';
  readonly bases: string;
  readonly out: string;
  readonly scratch: string;
  readonly split: FeasibilitySplit;
}

function parseArgs(argv: readonly string[]): Args | string {
  const [gate, ...rest] = argv;
  if (gate !== 'typecheck' && gate !== 'feasibility') return `unknown gate ${JSON.stringify(gate)}`;
  const v = new Map<string, string>();
  for (let i = 0; i < rest.length; i += 2) {
    const a = rest[i] ?? '';
    const val = rest[i + 1];
    const allowed = gate === 'feasibility' ? ['--bases', '--out', '--scratch', '--split'] : ['--bases', '--out', '--scratch'];
    if (!allowed.includes(a) || val === undefined) return `unexpected argument ${JSON.stringify(a)}`;
    v.set(a, val);
  }
  const bases = v.get('--bases');
  const out = v.get('--out');
  if (bases === undefined || out === undefined) return '--bases and --out are required';
  const split = v.get('--split') ?? 'held-out';
  if (split !== 'held-out' && split !== 'dev') return `--split must be held-out or dev, not ${JSON.stringify(split)}`;
  return { gate, bases, out, scratch: v.get('--scratch') ?? os.tmpdir(), split };
}

/** Reads and validates the prepared-base list. */
export function loadBases(file: string): PreparedBase[] | string {
  let list: unknown;
  try {
    list = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return '--bases is not a readable JSON file';
  }
  if (!Array.isArray(list) || list.length === 0) return '--bases must hold a non-empty JSON array of PreparedBase objects';
  const out: PreparedBase[] = [];
  for (const raw of list as PreparedBaseInput[]) {
    const b = makePreparedBase(raw);
    if (!b.success) return b.errors.map((e) => `${e.code}: ${e.message}`).join('; ');
    out.push(b.data);
  }
  return out;
}

/** Runs one measurement; returns the exit code. */
export async function main(argv: readonly string[], repoRoot: string, deps: BaseMeasureDeps = defaultBaseMeasureDeps()): Promise<number> {
  const fail = (message: string): number => {
    deps.err(`${scrubSecrets(message, knownSecrets())}\n`);
    return 2;
  };
  const args = parseArgs(argv);
  if (typeof args === 'string') return fail(`${args}\n${BASE_MEASURE_USAGE}`);
  const bases = loadBases(path.resolve(repoRoot, args.bases));
  if (typeof bases === 'string') return fail(bases);
  const measuredAt = deps.now().toISOString();
  if (args.gate === 'typecheck') {
    const r = await measureBaseTypecheck(deps.runner, bases, args.scratch);
    if (!r.success) return fail(r.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
    const files = writeBaseTypecheckTable(path.resolve(repoRoot, args.out), r.data, measuredAt);
    for (const row of r.data) deps.out(`${row.projectId}: tsc ${row.tscVersion}, ${String(row.errorCount)} errors${row.excluded ? ' (excluded)' : ''}\n`);
    deps.out(`wrote ${files.join(', ')}\n`);
    return r.data.some((row) => row.excluded) ? 1 : 0;
  }
  const table = await siteFeasibility(repoRoot, bases.map((base) => ({ base, split: args.split })), CATALOGUE_OPERATORS, args.scratch);
  if (!table.success) return fail(table.errors.map((e) => `${e.code}: ${e.message}`).join('; '));
  const choice = chooseSitesPerOperator(table.data, MASTER_SEED);
  const files = writeSiteFeasibilityTable(path.resolve(repoRoot, args.out), table.data, choice, measuredAt);
  const totals = heldOutTotals(table.data.golden);
  deps.out(`held-out golden totals: k = 2 -> ${String(totals.k2)}, k = 3 -> ${String(totals.k3)}\n`);
  deps.out(choice.success ? `sitesPerOperator: k = ${String(choice.data.k)}, total ${String(choice.data.total)}\n` : `${choice.errors.map((e) => `${e.code}: ${e.message}`).join('; ')}\n`);
  deps.out(`wrote ${files.join(', ')}\n`);
  return choice.success ? 0 : 1;
}
