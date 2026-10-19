/**
 * U11 dry run: one stub generation turn end to end through the loop with the Gemini adapter, a fake agy binary that
 * prints its result and hangs, and the real process runner (`scripts/v1.4/lib/gemini-turn-dry-run.ts`). Entry file: no
 * exports. NO agy process, NO model call. Everything sits in one OS temp scratch directory, removed afterwards; only the
 * scrubbed summary is written into the repository.
 *
 * Usage (repository root): npx tsx scripts/v1.4/gemini-turn-dry-run.ts [--out results/v1.4-gemini-turn-dry-run]
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runGeminiTurnDryRun } from './lib/gemini-turn-dry-run.js';

async function main(argv: readonly string[]): Promise<number> {
  const i = argv.indexOf('--out');
  const out = i >= 0 ? (argv[i + 1] ?? '') : 'results/v1.4-gemini-turn-dry-run';
  const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-turn-dry-run-')));
  try {
    const r = await runGeminiTurnDryRun(process.cwd(), scratch);
    if (!r.success) {
      process.stderr.write(`${r.errors.map((e) => `${e.code}: ${e.message}`).join('\n')}\n`);
      return 2;
    }
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'summary.json'), `${JSON.stringify(r.data, null, 2)}\n`);
    process.stdout.write(`wrote ${path.join(out, 'summary.json')}\n`);
    return 0;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

main(process.argv.slice(2)).then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
