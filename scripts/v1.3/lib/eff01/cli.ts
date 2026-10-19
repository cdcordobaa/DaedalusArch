/**
 * Flag parsing of `scripts/v1.3/eff-01-run.ts` (design §4, plan step 10). Unknown flags are refused, so a typo can
 * never silently fall back to a default.
 */
import * as path from 'node:path';
import type { DriverOptions } from './driver.js';
import { STUB_BEHAVIOURS } from './stub-runner.js';
import type { StubBehaviour } from './stub-runner.js';
import { EFF01_BLOCKS } from './types.js';
import type { Eff01Block } from './types.js';

const VALUE_FLAGS = [
  '--block', '--runs', '--lanes', '--harness', '--clones', '--config-dir', '--claude', '--model', '--cli-version', '--server-entry',
  '--out', '--confirm-sessions', '--rerun-allowance', '--questions-sha256', '--behaviour', '--fixture-tree', '--calibration-repo',
] as const;
const BOOL_FLAGS = ['--no-n', '--live', '--strip-spec-comments'] as const;

export type ParsedFlags = { readonly ok: true; readonly options: Omit<DriverOptions, 'repoRoot'> } | { readonly ok: false; readonly error: string };

function int(v: string | undefined, flag: string): number | string {
  if (v === undefined || !/^\d+$/.test(v)) return `${flag} needs a non-negative integer`;
  return Number.parseInt(v, 10);
}

export function parseRunFlags(argv: readonly string[], cwd: string): ParsedFlags {
  const values: Record<string, string> = {};
  const bools = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? '';
    if ((BOOL_FLAGS as readonly string[]).includes(a)) {
      bools.add(a);
      continue;
    }
    if ((VALUE_FLAGS as readonly string[]).includes(a)) {
      const v = argv[i + 1];
      if (v === undefined) return { ok: false, error: `${a} needs a value` };
      values[a] = v;
      i++;
      continue;
    }
    return { ok: false, error: `unknown flag ${a}` };
  }
  const blockArg = values['--block'] ?? 'all';
  let blocks: readonly Eff01Block[] | 'all' = 'all';
  if (blockArg !== 'all') {
    const list = blockArg.split(',').map((b) => b.trim());
    const bad = list.find((b) => !(EFF01_BLOCKS as readonly string[]).includes(b));
    if (bad !== undefined) return { ok: false, error: `--block ${bad} is not one of calibration, pilot, main, n, all` };
    blocks = list as Eff01Block[];
  }
  const nums: Record<string, number> = {};
  for (const f of ['--runs', '--lanes', '--confirm-sessions', '--rerun-allowance']) {
    if (values[f] === undefined) continue;
    const v = int(values[f], f);
    if (typeof v === 'string') return { ok: false, error: v };
    nums[f] = v;
  }
  const behaviour = values['--behaviour'];
  if (behaviour !== undefined && !(STUB_BEHAVIOURS as readonly string[]).includes(behaviour)) return { ok: false, error: `--behaviour ${behaviour} is unknown` };
  const abs = (v: string): string => path.resolve(cwd, v);
  const options: Omit<DriverOptions, 'repoRoot'> = {
    blocks,
    withN: !bools.has('--no-n'),
    live: bools.has('--live'),
    stripSpecComments: bools.has('--strip-spec-comments'),
    ...(nums['--runs'] !== undefined ? { runs: nums['--runs'] } : {}),
    ...(nums['--lanes'] !== undefined ? { lanes: nums['--lanes'] } : {}),
    ...(nums['--confirm-sessions'] !== undefined ? { confirmSessions: nums['--confirm-sessions'] } : {}),
    ...(nums['--rerun-allowance'] !== undefined ? { rerunAllowance: nums['--rerun-allowance'] } : {}),
    ...(values['--harness'] !== undefined ? { harness: values['--harness'] } : {}),
    ...(values['--clones'] !== undefined ? { clones: values['--clones'] } : {}),
    ...(values['--config-dir'] !== undefined ? { configDir: values['--config-dir'] } : {}),
    ...(values['--claude'] !== undefined ? { claude: values['--claude'] } : {}),
    ...(values['--model'] !== undefined ? { model: values['--model'] } : {}),
    ...(values['--cli-version'] !== undefined ? { cliVersion: values['--cli-version'] } : {}),
    ...(values['--server-entry'] !== undefined ? { serverEntry: abs(values['--server-entry']) } : {}),
    ...(values['--out'] !== undefined ? { out: abs(values['--out']) } : {}),
    ...(values['--questions-sha256'] !== undefined ? { questionsSha256: values['--questions-sha256'] } : {}),
    ...(behaviour !== undefined ? { behaviour: behaviour as StubBehaviour } : {}),
    ...(values['--fixture-tree'] !== undefined ? { fixtureTree: abs(values['--fixture-tree']) } : {}),
    ...(values['--calibration-repo'] !== undefined ? { calibrationRepo: values['--calibration-repo'] } : {}),
  };
  return { ok: true, options };
}
