/**
 * Build step: copy the v1.5 Cypher rules (`src/v15-instrument/rules/*.cypher`, the only rule definition) next to the
 * compiled graph module (`<outDir>/v15-instrument/rules/`), so `rulesDir()` finds them from an installed package.
 * Usage: node scripts/copy-v15-rules.mjs [outDir=dist]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(repo, 'src', 'v15-instrument', 'rules');
const out = path.join(path.resolve(process.argv[2] ?? path.join(repo, 'dist')), 'v15-instrument', 'rules');
fs.mkdirSync(out, { recursive: true });
const files = fs.readdirSync(src).filter((f) => f.endsWith('.cypher')).sort();
for (const f of files) fs.copyFileSync(path.join(src, f), path.join(out, f));
process.stdout.write(`copy-v15-rules: ${String(files.length)} rule file(s) -> ${out}\n`);
