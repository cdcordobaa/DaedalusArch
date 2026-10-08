/**
 * Base preparation and copies (U5a plan Step 9; BR-U5a-04, 08; domain-entities.md §2.1).
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { copyBase, makePreparedBase, prepareFixtureBase, repoTscPath, sha256File } from '../../../../scripts/lib/mutation/prepare.js';
import type { PreparedBaseInput } from '../../../../scripts/lib/mutation/prepare.js';
import type { PreparedBase } from '../../../../scripts/lib/mutation/types.js';

const REPO = process.cwd();
const FIXTURE = path.join(REPO, 'fixtures/correct-reference');
const SHA1 = 'a'.repeat(40);
const runner = new NodeProcessRunner();

/** sha256 over the sorted (relative path, content sha256) list of every file under `dir`. */
function treeDigest(dir: string): string {
  const entries: string[] = [];
  const walk = (d: string): void => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else entries.push(`${path.relative(dir, p)}\0${sha256File(p)}`);
    }
  };
  walk(dir);
  return crypto.createHash('sha256').update(entries.sort().join('\n')).digest('hex');
}

function input(over: Partial<PreparedBaseInput> = {}): PreparedBaseInput {
  return {
    projectId: 'p',
    baseKind: 'fixture',
    dir: FIXTURE,
    baseCommit: SHA1,
    tsconfigPath: 'tsconfig.json',
    tscPath: repoTscPath(REPO),
    tscVersion: '5.9.3',
    overlays: [],
    specPath: 'specs/clean-arch.yaml',
    ...over,
  };
}

let scratch: string;
beforeEach(() => {
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'u5a-prepare-'));
});
afterEach(() => {
  fs.rmSync(scratch, { recursive: true, force: true });
});

describe('prepareFixtureBase', () => {
  it('prepares correct-reference with the repo tsc, measured version and HEAD commit', async () => {
    const r = await prepareFixtureBase(runner, REPO, 'fixtures/correct-reference', 'specs/clean-arch.yaml');
    if (!r.success) throw new Error(JSON.stringify(r.errors));
    const b = r.data;
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO, 'node_modules/typescript/package.json'), 'utf8')) as { version: string };
    expect(b).toMatchObject({
      projectId: 'correct-reference',
      baseKind: 'fixture',
      dir: FIXTURE,
      tsconfigPath: 'tsconfig.json',
      tscPath: path.join(REPO, 'node_modules/typescript/lib/tsc.js'),
      tscVersion: pkg.version,
      overlays: [],
      specPath: 'specs/clean-arch.yaml',
      capped: false,
    });
    expect(b.baseCommit).toMatch(/^[0-9a-f]{40}$/);
    expect(b.judgeSelection).toBeUndefined();
    expect(b.installLockSha256).toBeUndefined();
    expect(Object.isFrozen(b)).toBe(true);
  });

  it('refuses a directory without tsconfig.json', async () => {
    const r = await prepareFixtureBase(runner, REPO, scratch, 'specs/clean-arch.yaml');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.errors[0]?.code).toBe('PREP_NO_TSCONFIG');
  });
});

describe('makePreparedBase invariants (§2.1)', () => {
  const sel = (capped: boolean) => ({ template: 'intent-alignment' as const, functionId: 'FF-N02', capped, selectedFiles: ['src/a.ts'] });

  it('derives capped from judgeSelection', () => {
    const r1 = makePreparedBase(input({ judgeSelection: [sel(false), sel(true)] }));
    const r2 = makePreparedBase(input({ judgeSelection: [sel(false)] }));
    expect(r1.success && r1.data.capped).toBe(true);
    expect(r2.success && r2.data.capped).toBe(false);
  });

  it('refuses capped inconsistent with judgeSelection', () => {
    for (const bad of [input({ capped: true }), input({ capped: false, judgeSelection: [sel(true)] }), input({ capped: true, judgeSelection: [sel(false)] })]) {
      const r = makePreparedBase(bad);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.errors[0]?.code).toBe('PREP_INVALID');
    }
    expect(makePreparedBase(input({ capped: true, judgeSelection: [sel(true)] })).success).toBe(true);
  });

  it('generated ⇔ baseGenerationTreeSha; fixture/corpus need baseCommit', () => {
    const omit = (o: PreparedBaseInput, k: keyof PreparedBaseInput): PreparedBaseInput => {
      const c = Object.fromEntries(Object.entries(o).filter(([key]) => key !== k));
      return c as unknown as PreparedBaseInput;
    };
    const generated = omit(input({ baseKind: 'generated', baseGenerationTreeSha: SHA1 }), 'baseCommit');
    expect(makePreparedBase(generated).success).toBe(true);
    expect(makePreparedBase(omit(generated, 'baseGenerationTreeSha')).success).toBe(false);
    expect(makePreparedBase({ ...generated, baseCommit: SHA1 }).success).toBe(false);
    expect(makePreparedBase(input({ baseGenerationTreeSha: SHA1 })).success).toBe(false);
    expect(makePreparedBase(omit(input(), 'baseCommit')).success).toBe(false);
    expect(makePreparedBase(input({ baseKind: 'corpus', baseCommit: 'abc' })).success).toBe(false);
  });

  it('refuses relative tscPath, absolute tsconfigPath, bad overlay and bad lock hashes', () => {
    expect(makePreparedBase(input({ tscPath: 'node_modules/typescript/lib/tsc.js' })).success).toBe(false);
    expect(makePreparedBase(input({ tsconfigPath: path.join(FIXTURE, 'tsconfig.json') })).success).toBe(false);
    expect(makePreparedBase(input({ overlays: [{ path: '../x.ts', sha256: 'c'.repeat(64) }] })).success).toBe(false);
    expect(makePreparedBase(input({ overlays: [{ path: 'src/x.ts', sha256: 'nothex' }] })).success).toBe(false);
    expect(makePreparedBase(input({ installLockSha256: 'short' })).success).toBe(false);
    expect(makePreparedBase(input({ projectId: 'a|b' })).success).toBe(false);
  });
});

describe('copyBase', () => {
  it('copies and edits without writing the source (BR-U5a-04)', async () => {
    const before = treeDigest(FIXTURE);
    const b = makePreparedBase(input());
    if (!b.success) throw new Error('base');
    const dest = path.join(scratch, 'correct-reference', 'MO-TEST', 'k-0');
    const c = await copyBase(b.data, dest);
    if (!c.success) throw new Error(JSON.stringify(c.errors));
    const task = path.join(c.data, 'src/domain/entities/Task.ts');
    fs.appendFileSync(task, '\nexport const edited = 1;\n');
    fs.writeFileSync(path.join(c.data, 'src/new-file.ts'), 'export {};\n');
    expect(treeDigest(FIXTURE)).toBe(before);
    expect(treeDigest(c.data)).not.toBe(before);
    expect(fs.readFileSync(path.join(FIXTURE, 'src/domain/entities/Task.ts'), 'utf8')).not.toContain('edited');
  });

  it('refuses an existing destination and a destination inside the base', async () => {
    const b = makePreparedBase(input());
    if (!b.success) throw new Error('base');
    const r1 = await copyBase(b.data, scratch);
    expect(!r1.success && r1.errors[0]?.code).toBe('MUT_COPY_EXISTS');
    const r2 = await copyBase(b.data, path.join(FIXTURE, 'nested-copy'));
    expect(!r2.success && r2.errors[0]?.code).toBe('MUT_COPY_INSIDE_BASE');
    expect(fs.existsSync(path.join(FIXTURE, 'nested-copy'))).toBe(false);
  });

  it('checks overlay sha256 in the copy and refuses a mismatch', async () => {
    const src = path.join(scratch, 'base');
    fs.mkdirSync(path.join(src, 'src'), { recursive: true });
    fs.writeFileSync(path.join(src, 'tsconfig.json'), '{}');
    fs.writeFileSync(path.join(src, 'src/config.ts'), 'export const port = 1;\n');
    const good = sha256File(path.join(src, 'src/config.ts'));
    const mk = (sha256: string): PreparedBase => {
      const r = makePreparedBase(input({ baseKind: 'corpus', dir: src, overlays: [{ path: 'src/config.ts', sha256 }] }));
      if (!r.success) throw new Error('base');
      return r.data;
    };
    const ok = await copyBase(mk(good), path.join(scratch, 'ok'));
    expect(ok.success).toBe(true);
    const bad = await copyBase(mk('d'.repeat(64)), path.join(scratch, 'bad'));
    expect(!bad.success && bad.errors[0]?.code).toBe('MUT_OVERLAY_MISMATCH');
    expect(fs.existsSync(path.join(scratch, 'bad'))).toBe(false);
    const missing = makePreparedBase(input({ baseKind: 'corpus', dir: src, overlays: [{ path: 'src/absent.ts', sha256: good }] }));
    if (!missing.success) throw new Error('base');
    const r = await copyBase(missing.data, path.join(scratch, 'missing'));
    expect(!r.success && r.errors[0]?.code).toBe('MUT_OVERLAY_MISMATCH');
  });
});
