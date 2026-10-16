/**
 * Writes a SYNTHETIC hold-out stand-in (scripts/v1.3/lib/synthetic-holdout.ts) for the freeze dry run. Entry file.
 * Usage (repository root):
 *   npx tsx scripts/v1.3/synthetic-holdout.ts --out <dir outside the repository>/v1.3-holdout [--id-map <file>]
 * Reads only tests/fixtures/v1.3-reference (the development set). Never reads a sealed path.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateSyntheticHoldout } from './lib/synthetic-holdout.js';
import { sealedTreeSha256, treeSha256 } from './lib/holdout-run-main.js';

const argv = process.argv.slice(2);
const val = (k: string): string | undefined => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const out = val('--out');
if (out === undefined || /daedalus-sealed/.test(path.resolve(out))) {
  process.stderr.write('usage: synthetic-holdout.ts --out <new dir, not under daedalus-sealed> [--id-map <file>]\n');
  process.exit(2);
}
const r = generateSyntheticHoldout(path.resolve('tests/fixtures/v1.3-reference'), path.resolve(out));
const idMapFile = path.resolve(val('--id-map') ?? path.join(path.dirname(r.out), 'synthetic-id-map.json'));
fs.writeFileSync(idMapFile, JSON.stringify(r.idMap, null, 2) + '\n');
process.stdout.write([
  `wrote ${r.out} (${String(r.renamed)} variants renamed; SYNTHETIC)`,
  `id map ${idMapFile}`,
  `planted miss ${r.plantedMiss.style}/${r.plantedMiss.variant} ${r.plantedMiss.ruleId} ${r.plantedMiss.file} -> ${r.plantedMiss.target}`,
  `tree sha256 (runner method) ${treeSha256(r.out).sha256}`,
  `tree sha256 (sealed-hashes method, as ${path.basename(r.out)}/) ${sealedTreeSha256(r.out)}`,
  '',
].join('\n'));
