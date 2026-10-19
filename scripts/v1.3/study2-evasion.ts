/**
 * Study 2 evasion check (decision M6; `Docs/v1.4/evasion-check.md`; design
 * `aidlc-docs/construction/v1.4/U5/functional-design/design.md` Part A). Post-hoc: it reads a loop out-root and never
 * changes a step record.
 *
 * Usage (repository root):
 *   npx tsx scripts/v1.3/study2-evasion.ts --out-root <loop out-root> --out <dir>
 *     [--from-step 2] [--sample-per-arm 10] [--seed 20261018] [--labels <form.csv>]
 *     [--cells none@L2,none@L3,daedalus-mcp@L2] [--h2 none@L2,daedalus-mcp@L2] [--h1 none@L2,none@L3]
 *     [--spec <repo-relative spec, used when a step record names none>]
 *
 * Writes `<out>/evasion.json` (`study2-evasion/v1`, deterministic), `<out>/evasion.md`, the blind packet `<out>/packet/`
 * and the sealed key `<out>/packet-key/key.json`. With `--labels`, the filled form is unblinded against the key already
 * in `<out>/packet-key/` (refused when its sha256 differs from the regenerated packet's, EV-07).
 *
 * Each run's `src/` snapshots are read from its `snapshots.git` (local git) into an OS temp scratch directory, removed
 * per snapshot and again in a `finally`. NO model call, NO network call, NO Neo4j connection (EV-09). Exit codes: 0 done;
 * 1 a snapshot was unreadable (recorded in `excluded.snapshotMissing`); 2 usage or input error.
 */
import { EVASION_USAGE, parseArgs, runEvasion } from './lib/evasion/run.js';

async function cli(argv: readonly string[]): Promise<number> {
  const args = parseArgs(argv);
  if (typeof args === 'string') {
    process.stderr.write(`${args}\n${EVASION_USAGE}`);
    return 2;
  }
  try {
    const r = await runEvasion(args, process.cwd());
    (r.exitCode === 2 ? process.stderr : process.stdout).write(`${r.message}\n`);
    return r.exitCode;
  } catch (e) {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
}

cli(process.argv.slice(2)).then(
  (code) => { process.exitCode = code; },
  (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`); process.exitCode = 2; },
);
