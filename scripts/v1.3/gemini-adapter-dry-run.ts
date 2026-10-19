/**
 * The recorded dry run of the Gemini generator adapter (decision CDX; `Docs/v1.4/gemini-generator.md`; design
 * `aidlc-docs/construction/v1.4/U5/functional-design/design.md` §3.6). Scripted runner: NO agy process, NO model call,
 * NO network, NO Neo4j. Every out-root, harness root, work directory and home sits in one OS temp scratch directory,
 * removed afterwards; only the scrubbed summary is written into the repository.
 *
 * Usage (repository root): npx tsx scripts/v1.3/gemini-adapter-dry-run.ts [--out results/v1.4-gemini-adapter-dry-run]
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { runGeminiAdapterDryRun } from './lib/gemini-adapter-dry-run.js';

async function main(argv: readonly string[]): Promise<number> {
  const i = argv.indexOf('--out');
  const out = i >= 0 ? (argv[i + 1] ?? '') : 'results/v1.4-gemini-adapter-dry-run';
  const scratch = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-adapter-dry-run-')));
  try {
    const r = await runGeminiAdapterDryRun(process.cwd(), scratch);
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
  (c) => { process.exitCode = c; },
  (e: unknown) => { process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`); process.exitCode = 2; },
);
