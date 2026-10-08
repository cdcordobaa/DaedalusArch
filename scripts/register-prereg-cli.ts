/**
 * CLI entry of `scripts/register-prereg.ts` (BR-U5b-50; Build and Test Step 5). No exports; D-U5a-13 (a) form
 * (`void main(...).then(...)`), because `tsconfig.scripts.json` compiles CommonJS, where a top-level `await` is
 * TS1378 (OI-U5a-16).
 * Usage: npx tsx scripts/register-prereg-cli.ts --reason <text> [--dry-run] | --self-test | --help
 */
import { main } from './register-prereg.js';

void main(process.argv.slice(2), process.cwd(), {
  out: (t) => process.stdout.write(t),
  err: (t) => process.stderr.write(t),
  now: () => new Date(),
}).then(
  (code) => {
    process.exitCode = code;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
