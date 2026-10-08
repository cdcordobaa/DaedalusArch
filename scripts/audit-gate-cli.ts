/**
 * CLI entry of `scripts/audit-gate.ts` (NFR-06; Build and Test Step 6). No exports; D-U5a-13 (a) form.
 * Usage: npx tsx scripts/audit-gate-cli.ts [--input <npm-audit.json>] | --self-test | --help
 */
import { main, npmAuditJson } from './audit-gate.js';

void main(process.argv.slice(2), process.cwd(), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  audit: () => npmAuditJson(process.cwd()),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
