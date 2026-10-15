/**
 * v1.2E byte-identity on every fixture project in the repository (every directory under `fixtures/` or `tests/fixtures/`
 * with a `tsconfig.json`): the full `APGResult` JSON under `V12E_DEFAULT_OPTIONS`, with the repository root replaced by
 * `<repo>`, must hash to the value pinned in `tests/fixtures/v1.3-byte-identity/v12e-hashes.json` (computed with
 * `scripts/apg-hash.ts --relative` on origin/v1.3 0263605d). A v1.3 change that alters the frozen instrument fails here.
 * A new fixture project must be added to the pinned file in the same change.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { extractAPG } from '../../../src/apg-extractor/index.js';
import { V12E_DEFAULT_OPTIONS } from '../../../src/apg-extractor/types.js';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const PINNED = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tests/fixtures/v1.3-byte-identity/v12e-hashes.json'), 'utf8')) as { v12e: Record<string, string> };

function fixtureProjects(): string[] {
  const out: string[] = [];
  const walk = (rel: string): void => {
    const abs = path.join(REPO_ROOT, rel);
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const child = path.posix.join(rel, e.name);
      if (e.isDirectory()) walk(child);
      else if (e.name === 'tsconfig.json') out.push(rel);
    }
  };
  walk('fixtures');
  walk('tests/fixtures');
  return out.sort();
}

describe('v1.2E byte-identity on every repo fixture', () => {
  const cwd = process.cwd();
  beforeAll(() => { process.chdir(REPO_ROOT); });
  afterAll(() => { process.chdir(cwd); });

  it('the pinned list covers every fixture project', () => {
    expect(fixtureProjects()).toEqual(Object.keys(PINNED.v12e).sort());
  });

  it.each(Object.keys(PINNED.v12e))('%s', async (p) => {
    const r = await extractAPG(p, V12E_DEFAULT_OPTIONS);
    const json = JSON.stringify(r).split(REPO_ROOT).join('<repo>');
    expect(createHash('sha256').update(json).digest('hex')).toBe(PINNED.v12e[p]);
  }, 120_000);
});
