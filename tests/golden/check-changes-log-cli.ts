/**
 * CLI entry of the golden change-log checker (D-U1-15): no exports, no direct-run guard.
 * Usage: npx tsx tests/golden/check-changes-log-cli.ts [--self-test] [<base>]
 */
import { main } from './check-changes-log.js';

void main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
