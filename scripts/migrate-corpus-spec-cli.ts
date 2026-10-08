/**
 * CLI entry of the corpus-spec migration (D-U1-15): no exports, no direct-run guard.
 * Usage: npx tsx scripts/migrate-corpus-spec-cli.ts --step fr22|cv02|fp06 <file>  |  --self-test
 */
import { main } from './migrate-corpus-spec.js';

void main(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
