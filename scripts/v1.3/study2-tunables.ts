/**
 * Study 2 frozen-tunables manifest: TOOLING, NOT A PRE-REGISTRATION. Entry file: no exports.
 * Schema and pass criterion: Docs/v1.3/study2-tunables.md; hashing: scripts/v1.3/lib/study2-tunables.ts.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/study2-tunables.ts write  <out.json>
 *   npx tsx scripts/v1.3/study2-tunables.ts verify <manifest.json>    exit 0 = no drift, 1 = drift, 2 = usage/unreadable
 * Uses no model, no network, no Neo4j and nothing outside the repository.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { buildTunablesManifest, diffManifests, hasDrift, manifestText, parseManifest, renderDrift } from './lib/study2-tunables.js';

const [cmd, file] = process.argv.slice(2);
const repoRoot = process.cwd();

async function main(): Promise<number> {
  if ((cmd !== 'write' && cmd !== 'verify') || file === undefined) {
    process.stderr.write('usage: study2-tunables.ts write <out.json> | verify <manifest.json>\n');
    return 2;
  }
  const live = await buildTunablesManifest(repoRoot);
  if (cmd === 'write') {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file, manifestText(live));
    process.stdout.write(`wrote ${String(Object.keys(live.entries).length)} entries to ${file}\n`);
    return 0;
  }
  let frozen;
  try {
    frozen = parseManifest(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    process.stderr.write(`${file}: ${e instanceof Error ? e.message : String(e)}\n`);
    return 2;
  }
  const drift = diffManifests(frozen, live);
  if (!hasDrift(drift)) {
    process.stdout.write(`study2 tunables ok (${String(Object.keys(live.entries).length)} entries)\n`);
    return 0;
  }
  process.stdout.write(`study2 tunables DRIFT against ${file}:\n${renderDrift(drift)}`);
  return 1;
}

main().then(
  (c) => {
    process.exitCode = c;
  },
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
