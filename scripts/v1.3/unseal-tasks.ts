/**
 * One-shot unsealing of the Study 2 task list (readiness lines D2, S14). Tooling, not a pre-registration. Entry file:
 * no exports. Logic: scripts/v1.3/lib/unseal.ts; procedure: Docs/v1.3/unsealing-procedure.md.
 * Usage (repository root; run ONCE by the author, locally; never by an agent on the sealed file):
 *   npx tsx scripts/v1.3/unseal-tasks.ts --file <tasks.md|tasks.json> --expected-sha256 <hex> \
 *     --out <tasks.json outside the repo> --audit <sheet.csv outside the repo> [--terms <terms.json>]
 * Refuses (exit 2) on a hash mismatch, an unreadable list or an output path inside the repository. Exit 3 when a step
 * holds a banned term (outputs are still written, for the unsealer). Prints counts, indices and hashes only.
 */
import * as path from 'node:path';
import { parseArgs, unseal } from './lib/unseal.js';

const repoRoot = process.cwd();
const here = path.join(repoRoot, 'scripts', 'v1.3');
try {
  const o = parseArgs(process.argv.slice(2), { termsFile: path.join(here, 'schemas', 'unseal-terms.json'), repoRoot });
  if (typeof o === 'string') {
    process.stderr.write(`${o}\n`);
    process.exitCode = 2;
  } else {
    const r = unseal(o);
    process.stdout.write(r.lines.join('\n') + '\n');
    process.exitCode = r.exitCode;
  }
} catch (e) {
  // Only the error class: a message could quote file content.
  process.stderr.write(`unseal-tasks failed (${e instanceof Error ? e.name : 'error'})\n`);
  process.exitCode = 2;
}
