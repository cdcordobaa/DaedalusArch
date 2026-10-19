/**
 * EFF-01 driver: graph tools plus files (G) vs files only (R), with a no-tool probe (N) (AI-DLC v1.4 U8; design
 * `aidlc-docs/construction/v1.4/U8/functional-design/design.md`; note `ops/notes/eff-01-efficiency-design.md`).
 * Entry file. **Dry run is the default** and makes zero calls: the stub runner stands in for claude, git and tar.
 *
 *   # dry run (zero calls), all 150 sessions over the fixture tree
 *   npx tsx scripts/v1.3/eff-01-run.ts --block all --out <scratch>/run --harness <abs scratch>/h --clones <abs scratch>/clones
 *       [--runs 1|2|3] [--no-n] [--lanes 1|2] [--behaviour key|wrong|…] [--fixture-tree <dir>] [--strip-spec-comments]
 *
 *   # live (needs the author's OK, a build, the clones and a clean config dir), one block per invocation
 *   npm run build
 *   npx tsx scripts/v1.3/eff-01-run.ts --live --block calibration,pilot --confirm-sessions 10 \
 *       --questions-sha256 <sha256 of experiments/eff-01/questions.json> --claude "$(command -v claude)" \
 *       --config-dir <abs clean config dir> --harness <abs dir outside the repo> --clones <abs dir> \
 *       --out experiments/eff-01/run-<YYYY-MM-DD> [--rerun-allowance k] [--lanes 1|2]
 *   npx tsx scripts/v1.3/eff-01-run.ts --live --block main --confirm-sessions 120 … (refused without a passing pilot-gate.json)
 *
 * Exit codes: 0 ok, 1 gate, leak or spawn-budget stop, 2 setup error (including every live-guard failure).
 */
import { runEff01 } from './lib/eff01/driver.js';
import { parseRunFlags } from './lib/eff01/cli.js';

async function main(argv: readonly string[]): Promise<number> {
  const repoRoot = process.cwd();
  const parsed = parseRunFlags(argv, repoRoot);
  if (!parsed.ok) {
    process.stderr.write(`eff-01-run: ${parsed.error}\n`);
    return 2;
  }
  const res = await runEff01({ ...parsed.options, repoRoot, log: (l) => process.stdout.write(`${l}\n`) });
  process.stdout.write(`eff-01-run: exit ${String(res.exitCode)}, ${String(res.sessionsRun)} sessions run this invocation\n`);
  return res.exitCode;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`eff-01-run: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
