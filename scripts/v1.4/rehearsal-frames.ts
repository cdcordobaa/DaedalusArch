/**
 * Writes the rehearsal frames, the DDD rehearsal spec and `hashes.json` (`scripts/v1.4/lib/rehearsal-frames.ts`) and
 * prints the hashes. Entry file: no exports.
 *
 * Usage (repository root): npx tsx scripts/v1.4/rehearsal-frames.ts [--check]
 * `--check` writes nothing and exits 1 when a committed file differs from what the code would write.
 * No model call, no Neo4j, no network.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { REHEARSAL_DIR, rehearsalFiles } from './lib/rehearsal-frames.js';

const repoRoot = process.cwd();
const check = process.argv.includes('--check');
const { files, hashes } = rehearsalFiles(repoRoot);
const all = new Map(files);
all.set(`${REHEARSAL_DIR}/hashes.json`, `${JSON.stringify(hashes, null, 2)}\n`);
const stale: string[] = [];
for (const [rel, text] of all) {
  const abs = path.join(repoRoot, rel);
  const now = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : undefined;
  if (now === text) continue;
  stale.push(rel);
  if (!check) {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
}
process.stdout.write(`${JSON.stringify(hashes, null, 2)}\n`);
if (check && stale.length > 0) {
  process.stderr.write(`rehearsal-frames: out of date: ${stale.join(', ')}\n`);
  process.exitCode = 1;
}
