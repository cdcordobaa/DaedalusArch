/**
 * Byte-identity check (aidlc-docs/construction/v1.3-barrels/barrels-notes.md §1): the sha256 of the full
 * `APGResult` JSON of every fixture project in the repo, under `V12E_DEFAULT_OPTIONS` and `V13_DEFAULT_OPTIONS`.
 * Usage: `npx tsx scripts/apg-hash.ts [--relative] [out.json]`. Run on two checkouts and compare the files.
 * `--relative` replaces the repository root's absolute path in the JSON by `<repo>` before hashing (the APG holds
 * absolute paths inside inferred type strings), so the hashes do not depend on where the checkout lives; this is the
 * form `tests/unit/apg-extractor/v12e-byte-identity.test.ts` pins.
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { extractAPG, V12E_DEFAULT_OPTIONS, V13_DEFAULT_OPTIONS } from '../src/apg-extractor/index.js';

const projects = execSync(
  "find fixtures tests/fixtures -name tsconfig.json -not -path '*/node_modules/*' | sort",
  { encoding: 'utf8' },
).split('\n').filter((l) => l !== '').map((p) => dirname(p));

const args = process.argv.slice(2);
const relative = args.includes('--relative');
const file = args.find((a) => a !== '--relative');

async function main(): Promise<void> {
  const out: Record<string, { v12e: string; v13: string }> = {};
  const root = process.cwd();
  for (const p of projects) {
    const hash = async (opts: object): Promise<string> => {
      const r = await extractAPG(p, opts);
      const json = JSON.stringify(r);
      return createHash('sha256').update(relative ? json.split(root).join('<repo>') : json).digest('hex');
    };
    const h = { v12e: await hash(V12E_DEFAULT_OPTIONS), v13: await hash(V13_DEFAULT_OPTIONS) };
    out[p] = h;
    console.log(p, h.v12e.slice(0, 12), h.v13.slice(0, 12));
  }
  if (file !== undefined) writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
}

void main().then(
  () => undefined,
  (e: unknown) => {
    process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
    process.exitCode = 2;
  },
);
