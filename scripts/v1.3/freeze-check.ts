/**
 * The v1.3 freeze check (Docs/v1.3/freeze-runbook.md). Entry file: no exports.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/freeze-check.ts --dry-run                       report every precondition, write nothing
 *   npx tsx scripts/v1.3/freeze-check.ts --run-tests                     run jest --maxWorkers=2, write the summary
 *   npx tsx scripts/v1.3/freeze-check.ts --commit <X> --write-manifest   write results/v1.3-freeze/manifest.json
 *   NEO4J_URI=... NEO4J_PASSWORD=... npx tsx scripts/v1.3/freeze-check.ts --commit <X>   strict: every check, engine probed
 * Options and exit codes: scripts/v1.3/lib/freeze-check.ts.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { scrubSecrets } from '../../src/shared/errors/scrub.js';
import { defaultGit } from './lib/holdout-run-main.js';
import { parseFreezeArgs, renderChecks, renderManifest, renderManifestSummary, runFreezeChecks, runTestSuite } from './lib/freeze-check.js';

const secrets = [process.env.NEO4J_PASSWORD ?? ''].filter((s) => s !== '');
const err = (t: string): void => { process.stderr.write(scrubSecrets(t, secrets)); };

async function main(): Promise<number> {
  const o = parseFreezeArgs(process.argv.slice(2));
  if (typeof o === 'string') {
    err(`${o}\n`);
    return 2;
  }
  const git = defaultGit(o.repoRoot);
  if (o.runTests) {
    const head = git(['rev-parse', 'HEAD']).trim();
    const summary = runTestSuite(o.repoRoot, head);
    fs.mkdirSync(path.dirname(path.resolve(o.repoRoot, o.tests)), { recursive: true });
    fs.writeFileSync(path.resolve(o.repoRoot, o.tests), JSON.stringify(summary, null, 1) + '\n');
    process.stdout.write(`wrote ${o.tests}: ${String(summary.numPassedTests)}/${String(summary.numTotalTests)} tests passed, ${String(summary.numFailedTests)} failed\n`);
    return summary.success === true ? 0 : 1;
  }
  const r = await runFreezeChecks(o, { git });
  if (o.writeManifest) {
    const file = path.resolve(o.repoRoot, o.manifest);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, renderManifest(r.manifest));
    process.stdout.write(`wrote ${o.manifest}\n`);
  }
  if (o.json) process.stdout.write(JSON.stringify({ commit: r.commit, checks: r.checks, manifest: r.manifest }, null, 1) + '\n');
  else process.stdout.write(renderChecks(r, o.dryRun) + renderManifestSummary(r.manifest));
  const unmet = r.checks.filter((c) => c.status === 'unmet');
  if (unmet.length > 0) err(`FREEZE CHECK FAILED: ${unmet.map((c) => c.id).join(', ')} unmet\n`);
  return unmet.length === 0 ? 0 : 1;
}

main().then((c) => { process.exitCode = c; }, (e: unknown) => {
  err(`${e instanceof Error ? e.message : String(e)}\n`);
  process.exitCode = 2;
});
