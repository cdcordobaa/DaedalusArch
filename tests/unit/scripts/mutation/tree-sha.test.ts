/**
 * Prepared-copy tree hash (U5a plan Step 12; Q9; BR-U5a-33; BR-U5a-04 by the BR-U5a-33 method).
 */
import { execFileSync } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { copyBase, prepareFixtureBase } from '../../../../scripts/lib/mutation/prepare.js';
import { provisionStubs } from '../../../../scripts/lib/mutation/stubs.js';
import { computeBaseTreeSha, computeTreeSha, treeShaFiles } from '../../../../scripts/lib/mutation/tree-sha.js';
import type { PreparedBase, ProvisionedStub } from '../../../../scripts/lib/mutation/types.js';

const REPO = process.cwd();
const TASK = 'src/domain/entities/Task.ts';
const runner = new NodeProcessRunner();

let scratch: string;
let tmpRoot: string;
let base: PreparedBase;
beforeAll(async () => {
  const r = await prepareFixtureBase(runner, REPO, 'fixtures/correct-reference', 'specs/clean-arch.yaml');
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  base = r.data;
});
beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-treesha-'));
  tmpRoot = path.join(scratch, 'stores');
  fs.mkdirSync(tmpRoot);
});
afterEach(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

/** A correct-reference copy with an installed package and a provisioned `express` stub. */
async function preparedCopy(name: string): Promise<{ copy: string; stubs: readonly ProvisionedStub[] }> {
  const c = await copyBase(base, path.join(scratch, name));
  if (!c.success) throw new Error('copy');
  const real = path.join(c.data, 'node_modules/real-pkg');
  fs.mkdirSync(real, { recursive: true });
  fs.writeFileSync(path.join(real, 'package.json'), '{"name":"real-pkg","types":"index.d.ts"}\n');
  fs.writeFileSync(path.join(real, 'index.d.ts'), 'export declare const r: number;\n');
  const stubs = provisionStubs(c.data, 'tsconfig.json', [{ specifier: 'express', fromFile: TASK, form: 'default' }]);
  if (!stubs.success) throw new Error('stubs');
  return { copy: c.data, stubs: stubs.data };
}

async function sha(copy: string, stubs: readonly ProvisionedStub[]): Promise<string> {
  const r = await computeBaseTreeSha(runner, base, copy, stubs, { tmpRoot });
  if (!r.success) throw new Error(JSON.stringify(r.errors));
  return r.data;
}

const git = (...args: string[]): string => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const fileSha = (f: string): string => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

describe('treeShaFiles', () => {
  it('lists tsconfig sources, overlay targets and stub files only, POSIX and sorted', async () => {
    const { copy, stubs } = await preparedCopy('list');
    const r = treeShaFiles(copy, 'tsconfig.json', [{ path: 'MANIFEST.md', sha256: 'e'.repeat(64) }], stubs);
    if (!r.success) throw new Error('files');
    expect(r.data).toContain(TASK);
    expect(r.data).toContain('MANIFEST.md');
    expect(r.data).toContain('node_modules/express/index.d.ts');
    expect(r.data).toContain('node_modules/express/package.json');
    expect(r.data.some((f) => f.startsWith('node_modules/real-pkg'))).toBe(false);
    expect(r.data).not.toContain('tsconfig.json');
    expect([...r.data].sort()).toEqual(r.data);
    expect(r.data).toHaveLength(13);
  });
});

describe('computeBaseTreeSha (BR-U5a-33)', () => {
  it('same copy twice → same sha; a second identical copy → same sha', async () => {
    const a = await preparedCopy('a');
    const b = await preparedCopy('b');
    const s1 = await sha(a.copy, a.stubs);
    expect(s1).toMatch(/^[0-9a-f]{40}$/);
    expect(await sha(a.copy, a.stubs)).toBe(s1);
    expect(await sha(b.copy, b.stubs)).toBe(s1);
  });

  it('a file added under a real node_modules package → unchanged', async () => {
    const { copy, stubs } = await preparedCopy('real');
    const before = await sha(copy, stubs);
    fs.writeFileSync(path.join(copy, 'node_modules/real-pkg/extra.d.ts'), 'export {};\n');
    expect(await sha(copy, stubs)).toBe(before);
  });

  it('a stub byte changed → changed; a source edit → changed', async () => {
    const { copy, stubs } = await preparedCopy('stub');
    const before = await sha(copy, stubs);
    fs.appendFileSync(path.join(copy, 'node_modules/express/index.d.ts'), ' ');
    const afterStub = await sha(copy, stubs);
    expect(afterStub).not.toBe(before);
    fs.appendFileSync(path.join(copy, TASK), '\n');
    expect(await sha(copy, stubs)).not.toBe(afterStub);
  });

  it('a .gitignore listing the stub does not change the sha', async () => {
    const plain = await preparedCopy('plain');
    const ignored = await preparedCopy('ignored');
    fs.writeFileSync(path.join(ignored.copy, '.gitignore'), 'node_modules/\nnode_modules/express/index.d.ts\n');
    expect(await sha(ignored.copy, ignored.stubs)).toBe(await sha(plain.copy, plain.stubs));
  });

  it('leaves the repository untouched and removes the temporary store', async () => {
    const indexPath = path.resolve(REPO, git('rev-parse', '--git-path', 'index').trim());
    const statusBefore = git('status', '--porcelain');
    const indexBefore = fileSha(indexPath);
    const objectsBefore = git('count-objects', '-v');
    const { copy, stubs } = await preparedCopy('repo');
    await sha(copy, stubs);
    // The fixture directory itself, which sits inside the repository's work tree.
    const fixtureFiles = treeShaFiles(base.dir, base.tsconfigPath, [], []);
    if (!fixtureFiles.success) throw new Error('files');
    const r = await computeTreeSha(runner, base.dir, fixtureFiles.data, { tmpRoot });
    expect(r.success).toBe(true);
    expect(git('status', '--porcelain')).toBe(statusBefore);
    expect(fileSha(indexPath)).toBe(indexBefore);
    expect(git('count-objects', '-v')).toBe(objectsBefore);
    expect(fs.readdirSync(tmpRoot)).toEqual([]);
  });

  it('a missing listed file fails with MUT_TREE_SHA and still removes the store', async () => {
    const { copy } = await preparedCopy('missing');
    const r = await computeTreeSha(runner, copy, ['src/absent.ts'], { tmpRoot });
    expect(!r.success && r.errors[0]?.code).toBe('MUT_TREE_SHA');
    expect(fs.readdirSync(tmpRoot)).toEqual([]);
  });
});

describe('BR-U5a-04 by the BR-U5a-33 method', () => {
  it('the tree sha of fixtures/correct-reference is identical before and after a copy-and-edit', async () => {
    const files = treeShaFiles(base.dir, base.tsconfigPath, [], []);
    if (!files.success) throw new Error('files');
    const before = await computeTreeSha(runner, base.dir, files.data, { tmpRoot });
    const { copy } = await preparedCopy('edit');
    fs.appendFileSync(path.join(copy, TASK), "\nimport express from 'express';\nexport const http = express;\n");
    const after = await computeTreeSha(runner, base.dir, files.data, { tmpRoot });
    expect(before.success && after.success).toBe(true);
    if (before.success && after.success) expect(after.data).toBe(before.data);
    expect(git('status', '--porcelain', '--', 'fixtures')).toBe('');
  });
});
