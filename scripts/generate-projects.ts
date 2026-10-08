/**
 * FR-28 generation grid (Claude Code headless, confined argv; BR-U5a-41..52). Entry file (D-U5a-13 a): no exports.
 * Usage (repository root): npx tsx scripts/generate-projects.ts --plan <plan.json> [--pilot] | --help
 */
import { scrubSecrets } from '../src/shared/errors/scrub.js';
import { main } from './lib/generators/generate-main.js';

void main(process.argv.slice(2), process.cwd()).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${scrubSecrets(e instanceof Error ? e.message : String(e), [])}\n`);
    process.exitCode = 2;
  },
);
