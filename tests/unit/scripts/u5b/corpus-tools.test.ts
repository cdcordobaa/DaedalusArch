/**
 * U5b Step 18: corpus selection, fetch and prepared bases (FR-36; BR-U5b-66..68, 76).
 * The fetch tests build a local bare repository from an inline tree at test time (fixed author / committer dates)
 * and use the real `git`, `npm` and `node`; no network.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { ProcessResult, ProcessRunner, ProcessRunOptions } from '../../../../src/shared/interfaces/process-runner.js';
import { buildChildEnv, NodeProcessRunner } from '../../../../src/shared/process/node-process-runner.js';
import { loadCorpus, parseCriteria, sha256Hex, validateCorpus } from '../../../../scripts/lib/corpus.js';
import type { CandidateAttributes, CorpusCandidate, CorpusCriteria, CorpusEntry, CorpusFile } from '../../../../scripts/lib/corpus.js';
import type { PreparedBase } from '../../../../scripts/lib/mutation/types.js';
import { copyBase } from '../../../../scripts/lib/mutation/prepare.js';
import {
  FETCH_SHA_MISMATCH, fetchCorpus, fetchEntry, INSTALL_LOCK_MISMATCH, OVERLAY_CHECK_FAILED, OVERLAY_SHA_MISMATCH,
} from '../../../../scripts/fetch-corpus.js';
import type { FetchOptions } from '../../../../scripts/fetch-corpus.js';
import { judgeSelectionOf, parseTscVersion, PREP_SELECTION_MISSING, PREP_TSC_MISMATCH, prepareBase } from '../../../../scripts/prepare-bases.js';
import type { StoredBaselineSelection } from '../../../../scripts/prepare-bases.js';
import {
  CORPUS_SHORTFALL, countSourceFiles, exclusionReason, firstParentChain, lockTypescriptVersion, resolveAddedEntry, searchCandidates,
  selectCorpus, selectExtension,
} from '../../../../scripts/select-corpus.js';
import type { CandidateList } from '../../../../scripts/select-corpus.js';
import { ROOT } from './score-fixture.js';

const FIX = join(ROOT, 'tests/fixtures/u5b/corpus-repo');
const REPO_TSC_VERSION = (JSON.parse(readFileSync(join(ROOT, 'node_modules/typescript/package.json'), 'utf8')) as { version: string }).version;
const DEPS = { 'local-dep': 'file:vendor/local-dep' };
const LOCK = `${JSON.stringify({
  name: 'fixture-repo', version: '1.0.0', lockfileVersion: 3, requires: true,
  packages: { '': { name: 'fixture-repo', version: '1.0.0', dependencies: DEPS }, 'node_modules/local-dep': { resolved: 'vendor/local-dep', link: true }, 'vendor/local-dep': { version: '1.0.0' } },
}, null, 2)}\n`;
const TREE: Readonly<Record<string, string>> = {
  'package.json': `${JSON.stringify({ name: 'fixture-repo', version: '1.0.0', private: true, dependencies: DEPS, scripts: { postinstall: "node -e \"require('fs').writeFileSync('POSTINSTALL_RAN', '')\"" } }, null, 2)}\n`,
  'package-lock.json': LOCK,
  'vendor/local-dep/package.json': '{ "name": "local-dep", "version": "1.0.0" }\n',
  'tsconfig.json': '{ "compilerOptions": { "strict": true }, "include": ["src/**/*.ts"] }\n',
  '.gitignore': 'node_modules/\n',
  'src/index.ts': "export * from './app/user.service';\n",
  'src/app/user.service.ts': 'export class UserService {}\n',
  'src/domain/user.entity.ts': 'export class User {}\n',
};

let work: string;
let bare: string;
let sha: string;

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '', HOME: work, GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@example.invalid', GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z',
      GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@example.invalid', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z',
    },
  }).trim();
}

beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'u5b-corpus-'));
  const src = join(work, 'src-repo');
  for (const [p, t] of Object.entries(TREE)) {
    mkdirSync(dirname(join(src, p)), { recursive: true });
    writeFileSync(join(src, p), t);
  }
  git(work, 'init', '-q', '-b', 'main', src);
  git(src, 'add', '-A');
  git(src, 'commit', '-q', '-m', 'fixture');
  sha = git(src, 'rev-parse', 'HEAD');
  bare = join(work, 'fixture-repo.git');
  git(work, 'clone', '-q', '--bare', src, bare);
});

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

const opts = (extra: Partial<FetchOptions> = {}): FetchOptions => ({
  repoRoot: ROOT, runner: new NodeProcessRunner(), env: buildChildEnv(process.env, ['PATH', 'HOME', 'TMPDIR']),
  now: () => new Date('2026-10-08T00:00:00Z'), ...extra,
});

const configOverlay = { path: 'src/config.ts', patchFile: 'tests/fixtures/u5b/corpus-repo/overlays/config.patch', sha256: sha256Hex(readFileSync(join(FIX, 'overlays/config.patch'))) };
const conflictOverlay = { path: 'src/app/user.service.ts', patchFile: 'tests/fixtures/u5b/corpus-repo/overlays/conflict.patch', sha256: sha256Hex(readFileSync(join(FIX, 'overlays/conflict.patch'))) };

function entry(extra: Partial<CorpusEntry> = {}): CorpusEntry {
  return {
    name: 'fixture-repo', originUrl: bare, licence: 'mit', commitSha: sha, core: false, specPath: 'corpus/specs/fixture-repo.yaml',
    overlays: [configOverlay], install: { policy: 'none' },
    tsc: { kind: 'repo-pinned', tscPath: 'node_modules/typescript/bin/tsc', tscVersion: REPO_TSC_VERSION }, ...extra,
  };
}

function first<T>(xs: readonly T[]): T {
  const x = xs[0];
  if (x === undefined) throw new Error('empty fixture list');
  return x;
}

const freshDest = (tag: string): string => join(mkdtempSync(join(work, `${tag}-`)), 'clone');

describe('fetchCorpus (BR-U5b-67)', () => {
  it('fetches twice to the same tree hash, with the overlay applied', async () => {
    const a = await fetchEntry(entry(), freshDest('a'), opts());
    const b = await fetchEntry(entry(), freshDest('b'), opts());
    if (!a.ok || a.checkedOnly || !b.ok || b.checkedOnly) throw new Error(JSON.stringify([a, b]));
    expect(a.record.treeHash).toMatch(/^[0-9a-f]{40}$/);
    expect(a.record.treeHash).toBe(b.record.treeHash);
    expect(a.record).toMatchObject({ projectId: 'fixture-repo', commitSha: sha, overlaysApplied: 1, installPolicy: 'none', fetchedAt: '2026-10-08T00:00:00.000Z' });
    expect(readFileSync(join(a.dir, 'src/config.ts'), 'utf8')).toBe('export const PORT = 3000;\n');
    const plain = await fetchEntry(entry({ overlays: [] }), freshDest('c'), opts());
    if (!plain.ok || plain.checkedOnly) throw new Error('plain fetch failed');
    expect(plain.record.treeHash).not.toBe(a.record.treeHash);
  });

  it('installs with lifecycle scripts disabled and excludes node_modules from the tree hash', async () => {
    const e = entry({ install: { policy: 'npm-ci-ignore-scripts', lockSha256: sha256Hex(LOCK) } });
    const a = await fetchEntry(e, freshDest('i'), opts());
    const b = await fetchEntry(entry(), freshDest('j'), opts());
    if (!a.ok || a.checkedOnly || !b.ok || b.checkedOnly) throw new Error(JSON.stringify([a, b]));
    expect(a.record.installPolicy).toBe('npm-ci-ignore-scripts');
    expect(existsSync(join(a.dir, 'node_modules/local-dep/package.json'))).toBe(true);
    expect(existsSync(join(a.dir, 'POSTINSTALL_RAN'))).toBe(false);
    expect(a.record.treeHash).toBe(b.record.treeHash);
    const bad = await fetchEntry(entry({ install: { policy: 'npm-ci-ignore-scripts', lockSha256: 'f'.repeat(64) } }), freshDest('k'), opts());
    expect(bad).toMatchObject({ ok: false, code: INSTALL_LOCK_MISMATCH });
  }, 120_000);

  it('rejects a wrong commitSha with FETCH_SHA_MISMATCH', async () => {
    const r = await fetchEntry(entry({ commitSha: '1'.repeat(40) }), freshDest('w'), opts());
    expect(r).toMatchObject({ ok: false, code: FETCH_SHA_MISMATCH });
  });

  it('stops on a conflicting overlay with OVERLAY_CHECK_FAILED and leaves the clone unpatched', async () => {
    const dest = freshDest('x');
    const r = await fetchEntry(entry({ overlays: [configOverlay, conflictOverlay] }), dest, opts());
    expect(r).toMatchObject({ ok: false, code: OVERLAY_CHECK_FAILED });
    expect(existsSync(join(dest, 'src/config.ts'))).toBe(false);
    expect(execFileSync('git', ['-C', dest, 'status', '--porcelain'], { encoding: 'utf8' })).toBe('');
  });

  it('rejects an overlay whose sha256 differs from the patch file, before cloning', async () => {
    const dest = freshDest('s');
    const r = await fetchEntry(entry({ overlays: [{ ...configOverlay, sha256: '0'.repeat(64) }] }), dest, opts());
    expect(r).toMatchObject({ ok: false, code: OVERLAY_SHA_MISMATCH });
    expect(existsSync(dest)).toBe(false);
  });

  it('--check mode verifies SHA and overlays without applying them; fetchCorpus continues past a failing entry', async () => {
    const root = mkdtempSync(join(work, 'many-'));
    const rs = await fetchCorpus([entry({ name: 'bad', commitSha: '2'.repeat(40) }), entry({ name: 'good' })], root, opts({ check: true }));
    expect(rs[0]).toMatchObject({ ok: false, code: FETCH_SHA_MISMATCH, projectId: 'bad' });
    expect(rs[1]).toMatchObject({ ok: true, checkedOnly: true });
    expect(existsSync(join(root, 'good/src/config.ts'))).toBe(false);
  });
});

describe('corpus.json schema (BR-U5b-66)', () => {
  const fixture = JSON.parse(readFileSync(join(FIX, 'corpus.json'), 'utf8')) as CorpusFile;

  it('the fixture validates, including the overlay sha256 against its patch file', () => {
    expect(validateCorpus(fixture, ROOT)).toEqual([]);
    expect(loadCorpus(join(FIX, 'corpus.json'), ROOT).ok).toBe(true);
  });

  it('an entry without install fails the schema', () => {
    const { install: _drop, ...rest } = first(fixture.entries);
    expect(validateCorpus({ ...fixture, entries: [rest] }, ROOT).join('\n')).toMatch(/CORPUS_INVALID: .*install/);
  });

  it('an entry whose overlay sha256 differs from the patch file is rejected', () => {
    const e = first(fixture.entries);
    const bad = { ...fixture, entries: [{ ...e, overlays: [{ ...e.overlays[0], sha256: 'a'.repeat(64) }] }] };
    expect(validateCorpus(bad, ROOT).join('\n')).toMatch(/OVERLAY_SHA_MISMATCH/);
  });

  it('an npm install policy needs a lock sha256; duplicate names are rejected', () => {
    const e = first(fixture.entries);
    expect(validateCorpus({ ...fixture, entries: [{ ...e, install: { policy: 'npm-ci-ignore-scripts' } }] }, ROOT)).not.toEqual([]);
    expect(validateCorpus({ ...fixture, entries: [e, e] }, ROOT).join('\n')).toMatch(/duplicate name/);
  });
});

describe('selectCorpus (BR-U5b-68)', () => {
  const criteria: CorpusCriteria = parseCriteria(readFileSync(join(ROOT, 'Docs/corpus-criteria.md'), 'utf8'));
  const cand = (name: string, extra: Partial<CorpusCandidate> = {}): CorpusCandidate => ({
    name, originUrl: `https://github.com/${name}.git`, licence: 'mit', fileCount: 100, style: 'nestjs', commitSha: 'a'.repeat(40),
    backend: true, hasPackageLock: true, isArchived: false, isFork: false, treeTruncated: false, ...extra,
  });
  const list: CandidateList = {
    searchedAt: '2026-10-08T00:00:00.000Z', tool: 'test',
    candidates: [
      cand('o/a'), cand('o/b', { style: 'clean-architecture' }), cand('o/c'), cand('o/d', { style: 'layered' }), cand('o/e'),
      cand('o/f'), cand('o/g', { style: 'layered' }), cand('o/big', { fileCount: 400 }), cand('o/nolic', { licence: 'none' }),
      cand('o/other', { licence: 'other' }), cand('o/fe', { backend: false }), cand('o/nolock', { hasPackageLock: false }),
      cand('o/arch', { isArchived: true }), cand('o/fork', { isFork: true }), cand('o/core'),
    ],
  };
  const core = ['https://github.com/o/core'];

  it('reads the criteria machine block of Docs/corpus-criteria.md', () => {
    expect(criteria).toMatchObject({ version: 1, minFiles: 20, maxFiles: 300, addMin: 3, addMax: 5, preferLayered: true, seed: 20261008 });
    expect(() => parseCriteria('no block')).toThrow(/expected one/);
  });

  it('returns the same 3–5 entries twice for a fixed seed, a layered project first', () => {
    const a = selectCorpus(list, criteria, core);
    const b = selectCorpus({ ...list, candidates: [...list.candidates].reverse() }, criteria, core);
    if (!a.ok || !b.ok) throw new Error('selection failed');
    expect(a.selection.selected.map((s) => s.name)).toEqual(b.selection.selected.map((s) => s.name));
    expect(a.selection.selected).toHaveLength(5);
    expect(a.selection.selected[0]?.style).toBe('layered');
    expect(a.selection.layeredNote).toBeNull();
    const other = selectCorpus(list, { ...criteria, seed: 7 }, core);
    if (!other.ok) throw new Error('selection failed');
    expect(other.selection.selected).toHaveLength(5);
  });

  it('excludes a 400-file or unlicensed candidate with a reason, and gives every non-selected candidate one', () => {
    const r = selectCorpus(list, criteria, core);
    if (!r.ok) throw new Error('selection failed');
    const reasons = Object.fromEntries(r.selection.excluded.map((x) => [x.name, x.reason]));
    expect(reasons).toMatchObject({
      'o/big': 'files-out-of-range', 'o/nolic': 'licence-not-osi', 'o/other': 'licence-not-osi', 'o/fe': 'not-backend',
      'o/nolock': 'no-package-lock', 'o/arch': 'archived', 'o/fork': 'fork', 'o/core': 'core-duplicate',
    });
    expect(r.selection.excluded.length + r.selection.selected.length).toBe(list.candidates.length);
    expect(r.selection.excluded.filter((x) => x.reason === 'not drawn')).toHaveLength(2);
    expect(exclusionReason(cand('o/t', { treeTruncated: true }), criteria, new Set())).toBe('tree-truncated');
  });

  it('states the reason when no layered candidate is eligible, and stops below addMin', () => {
    const noLayered = { ...list, candidates: list.candidates.filter((c) => c.style !== 'layered') };
    const r = selectCorpus(noLayered, criteria, core);
    if (!r.ok) throw new Error('selection failed');
    expect(r.selection.layeredNote).toBe('no eligible layered candidate');
    const short = selectCorpus({ ...list, candidates: list.candidates.slice(0, 2) }, criteria, core);
    expect(short).toMatchObject({ ok: false, code: CORPUS_SHORTFALL });
  });

  it('counts source files by rule C2 and reads the lock-file TypeScript version', () => {
    expect(countSourceFiles(['src/a.ts', 'src/b/c.ts', 'src/a.spec.ts', 'src/x.test.ts', 'src/t.d.ts', 'lib/z.ts', 'src/y.js'])).toBe(2);
    expect(lockTypescriptVersion(JSON.stringify({ packages: { 'node_modules/typescript': { version: '5.4.5' } } }))).toBe('5.4.5');
    expect(lockTypescriptVersion(JSON.stringify({ dependencies: { typescript: { version: '4.7.4' } } }))).toBe('4.7.4');
  });

  it('searchCandidates and resolveAddedEntry use gh only (fake runner)', async () => {
    const lock = JSON.stringify({ packages: { 'node_modules/typescript': { version: '5.1.6' } } });
    const calls: string[][] = [];
    const runner: ProcessRunner = {
      run(command: string, args: readonly string[], _o: ProcessRunOptions) {
        calls.push([command, ...args]);
        let stdout = '[]';
        if (args[0] === 'search' && args.includes('--topic=layered-architecture') && args.includes('--topic=nestjs')) {
          stdout = JSON.stringify([{ fullName: 'o/l', url: 'https://github.com/o/l', license: { key: 'mit' }, isArchived: false, isFork: false, defaultBranch: 'main' }]);
        } else if (args[0] === 'search' && args.includes('--topic=clean-architecture')) {
          stdout = JSON.stringify([{ fullName: 'o/l', url: 'https://github.com/o/l', license: { key: 'mit' }, isArchived: false, isFork: false, defaultBranch: 'main' }]);
        } else if (args[1]?.endsWith('/commits/main')) stdout = `${'c'.repeat(40)}\n`;
        else if (args[1]?.includes('/git/trees/')) stdout = JSON.stringify({ truncated: false, tree: [{ path: 'package.json', type: 'blob' }, { path: 'package-lock.json', type: 'blob' }, ...Array.from({ length: 25 }, (_, i) => ({ path: `src/f${String(i)}.ts`, type: 'blob' }))] });
        else if (args.at(-1)?.includes('contents/package.json')) stdout = JSON.stringify({ dependencies: { '@nestjs/core': '^10' } });
        else if (args.at(-1)?.includes('contents/package-lock.json')) stdout = lock;
        const data: ProcessResult = { exitCode: 0, stdout, stderr: '', timedOut: false, durationMs: 1 };
        return Promise.resolve({ success: true as const, data });
      },
    };
    const deps = { runner, env: {} };
    const l = await searchCandidates(deps, () => new Date('2026-10-08T00:00:00Z'), criteria.backendPackages);
    expect(l.candidates).toEqual([{
      name: 'o/l', originUrl: 'https://github.com/o/l.git', licence: 'mit', commitSha: 'c'.repeat(40), fileCount: 25, style: 'layered',
      backend: true, hasPackageLock: true, isArchived: false, isFork: false, treeTruncated: false, queries: ['Q1', 'Q3'],
    }]);
    expect(calls.every((c) => c[0] === 'gh')).toBe(true);
    const e = await resolveAddedEntry(deps, first(l.candidates));
    expect(e).toMatchObject({ name: 'o__l', core: false, install: { policy: 'npm-ci-ignore-scripts', lockSha256: sha256Hex(lock) }, tsc: { kind: 'project', tscVersion: '5.1.6' }, specPath: 'corpus/specs/o__l.yaml' });
  });
});

describe('E7-x extension (Docs/corpus-criteria.md §7; ADR-027)', () => {
  const criteria: CorpusCriteria = parseCriteria(readFileSync(join(ROOT, 'Docs/corpus-criteria.md'), 'utf8'));
  const attrs = (E: 0 | 1, H: 0 | 1, F: 0 | 1, R: 0 | 1): CandidateAttributes => ({
    E, H, F, R, P: E + H + F + R, A: [],
    evidence: { enforcement: [], readmeHexagonal: false, fixCommit: null, commits: 60, contributors: 3, hasTests: true },
  });
  /** `a` null = no recorded attributes (an excluded candidate). */
  const cand = (name: string, extra: Partial<CorpusCandidate> = {}, a: CandidateAttributes | null = attrs(0, 0, 0, 0)): CorpusCandidate => ({
    name, originUrl: `https://github.com/${name}.git`, licence: 'mit', fileCount: 100, style: 'clean-architecture', commitSha: 'a'.repeat(40),
    backend: true, hasPackageLock: true, isArchived: false, isFork: false, treeTruncated: false, ...(a === null ? {} : { attributes: a }), ...extra,
  });
  const list: CandidateList = {
    searchedAt: '2026-10-09T00:00:00.000Z', tool: 'test',
    candidates: [
      cand('a/top1', {}, attrs(1, 1, 1, 1)), cand('a/top2', {}, attrs(1, 1, 1, 1)),
      cand('b/three', { fileCount: 790 }, attrs(1, 1, 1, 0)), cand('c/two', {}, attrs(1, 1, 0, 0)),
      cand('d/two', {}, attrs(0, 1, 0, 1)), cand('e/one', {}, attrs(0, 0, 0, 1)), cand('f/zero'),
      cand('g/zero'), cand('h/layered', { style: 'layered' }),
      cand('x/huge', { fileCount: 801 }, null), cand('x/pnpm', { hasPackageLock: false, hasPnpmLock: true }, null),
      cand('x/round1', {}, null), cand('core/c', {}, null),
    ],
  };
  const core = ['https://github.com/core/c'];
  const corpus = [...core, 'https://github.com/x/round1.git'];

  it('parses the extension block: C2 20–800, addMax 6, owner cap 1, round-1 keys unchanged', () => {
    expect(criteria).toMatchObject({ maxFiles: 300, addMax: 5 });
    expect(criteria.extension).toMatchObject({ id: 'E7-x', minFiles: 20, maxFiles: 800, addMin: 3, addMax: 6, ownerCap: 1, seed: 20261008, hexagonalQueries: ['Q7', 'Q8'] });
    expect(new RegExp(criteria.extension?.fixMessage ?? '', 'i').test('refactor: move ports out of domain')).toBe(true);
    expect(new RegExp(criteria.extension?.fixMessage ?? '', 'i').test('fix circular import')).toBe(true);
    expect(new RegExp(criteria.extension?.fixMessage ?? '', 'i').test('bump deps')).toBe(false);
    expect(new RegExp(criteria.extension?.hexagonalReadme ?? '', 'i').test('Ports & Adapters')).toBe(true);
  });

  it('draws the layered candidate first, then tiers top-down, with the owner cap, deterministically', () => {
    const a = selectExtension(list, criteria, core, corpus);
    const b = selectExtension({ ...list, candidates: [...list.candidates].reverse() }, criteria, core, corpus);
    if (!a.ok || !b.ok) throw new Error('selection failed');
    expect({ ...a.selection, candidatesSha256: '' }).toEqual({ ...b.selection, candidatesSha256: '' });
    const sel = a.selection.selected;
    expect(sel).toHaveLength(6);
    expect(sel[0]).toMatchObject({ name: 'h/layered', via: 'preferLayered' });
    expect(sel.slice(1).map((s) => s.tier)).toEqual([...sel.slice(1).map((s) => s.tier)].sort((x, y) => y - x));
    expect(sel.filter((s) => s.name.startsWith('a/'))).toHaveLength(1);
    expect(sel.map((s) => s.name)).toEqual(expect.arrayContaining(['b/three', 'c/two', 'd/two', 'e/one']));
    const reasons = Object.fromEntries(a.selection.excluded.map((x) => [x.name, x.reason]));
    expect(reasons).toMatchObject({ 'x/huge': 'files-out-of-range', 'x/pnpm': 'no-package-lock', 'x/round1': 'corpus-duplicate', 'core/c': 'core-duplicate', 'f/zero': 'not drawn', 'g/zero': 'not drawn' });
    expect(Object.values(reasons).filter((r) => r === 'owner-cap')).toHaveLength(1);
    expect(a.selection.excluded.length + sel.length).toBe(list.candidates.length);
    expect(a.selection.tiers).toEqual([{ P: 4, eligible: 2 }, { P: 3, eligible: 1 }, { P: 2, eligible: 2 }, { P: 1, eligible: 1 }, { P: 0, eligible: 3 }]);
  });

  it('ends with CORPUS_SHORTFALL below addMin, and refuses an eligible candidate without attributes', () => {
    const short = selectExtension({ ...list, candidates: list.candidates.slice(0, 2) }, criteria, core, corpus);
    expect(short).toMatchObject({ ok: false, code: CORPUS_SHORTFALL });
    expect(() => selectExtension({ ...list, candidates: [cand('z/z', {}, null), ...list.candidates] }, criteria, core, corpus)).toThrow(/no recorded attributes/);
  });

  it('walks the first-parent chain only', () => {
    const listing = [
      { s: 'h', p: 'm', m: 'merge' }, { s: 'b2', p: 'b1', m: 'side: move domain' }, { s: 'm', p: 'r', m: 'main' }, { s: 'b1', p: 'r', m: 'side' }, { s: 'r', p: null, m: 'root' },
    ];
    expect(firstParentChain(listing, 'h').map((c) => c.s)).toEqual(['h', 'm', 'r']);
  });

  it('searchCandidates records lock kinds and computes E, H, F, R, A for eligible candidates only (fake gh)', async () => {
    const hit = (n: string): Record<string, unknown> => ({ fullName: n, url: `https://github.com/${n}`, license: { key: 'mit' }, isArchived: false, isFork: false, defaultBranch: 'main' });
    const src = Array.from({ length: 25 }, (_, i) => ({ path: `src/f${String(i)}.ts`, type: 'blob' }));
    const calls: string[][] = [];
    const runner: ProcessRunner = {
      run(_command: string, args: readonly string[], _o: ProcessRunOptions) {
        calls.push([...args]);
        let stdout = '[]';
        let exitCode = 0;
        const path = args.find((a) => a.startsWith('repos/')) ?? '';
        if (args[0] === 'search' && args.includes('--topic=hexagonal-architecture') && !args.includes('--topic=nestjs')) stdout = JSON.stringify([hit('o/hex'), hit('o/yarn')]);
        else if (path.endsWith('/commits/main')) stdout = `${'c'.repeat(40)}\n`;
        else if (path.includes('/git/trees/')) {
          const extra = path.startsWith('repos/o/yarn') ? [{ path: 'yarn.lock', type: 'blob' }]
            : [{ path: 'package-lock.json', type: 'blob' }, { path: '.dependency-cruiser.cjs', type: 'blob' }, { path: 'AGENTS.md', type: 'blob' }, { path: 'src/a.spec.ts', type: 'blob' }];
          stdout = JSON.stringify({ truncated: false, tree: [{ path: 'package.json', type: 'blob' }, ...extra, ...src] });
        } else if (path.includes('contents/package.json')) stdout = JSON.stringify({ dependencies: { express: '^4' }, devDependencies: { tsarch: '^5' } });
        else if (path.includes('/readme')) stdout = 'A clean architecture API';
        else if (path.includes('/commits?sha=')) {
          stdout = [{ s: 'c'.repeat(40), p: 'd'.repeat(40), m: 'feat: x' }, { s: 'd'.repeat(40), p: null, m: 'refactor: move port out of domain' }]
            .map((c) => JSON.stringify(c)).join('\n');
        } else if (path.includes('/commits/ddd')) stdout = 'src/domain/port.ts\nsrc/application/port.ts\n';
        else if (path.includes('/contributors')) stdout = '2\n';
        else exitCode = 0;
        const data: ProcessResult = { exitCode, stdout, stderr: '', timedOut: false, durationMs: 1 };
        return Promise.resolve({ success: true as const, data });
      },
    };
    const ext = criteria.extension;
    if (ext === undefined) throw new Error('no extension');
    const l = await searchCandidates({ runner, env: {} }, () => new Date('2026-10-09T00:00:00Z'), criteria.backendPackages, { criteria, extension: ext, coreOrigins: [], corpusOrigins: [] });
    const byName = Object.fromEntries(l.candidates.map((c) => [c.name, c]));
    expect(byName['o/yarn']).toMatchObject({ hasPackageLock: false, hasYarnLock: true, hasPnpmLock: false, queries: ['Q7'] });
    expect(byName['o/yarn']?.attributes).toBeUndefined();
    expect(byName['o/hex']?.attributes).toEqual({
      E: 1, H: 1, F: 1, R: 0, P: 3, A: ['AGENTS.md'],
      evidence: { enforcement: ['.dependency-cruiser.cjs', 'package.json:tsarch'], readmeHexagonal: false, fixCommit: { sha: 'd'.repeat(40), subject: 'refactor: move port out of domain' }, commits: 2, contributors: 2, hasTests: true },
    });
    expect(calls.some((c) => c.includes('--topic=fastify'))).toBe(true);
  });
});

describe('prepareBase (BR-U5b-76)', () => {
  const stored = JSON.parse(readFileSync(join(FIX, 'selection.json'), 'utf8')) as StoredBaselineSelection;
  let clone: string;

  beforeAll(async () => {
    clone = freshDest('p');
    const r = await fetchEntry(entry(), clone, opts());
    if (!r.ok) throw new Error(r.detail);
  });

  it('emits a value of U5a’s PreparedBase type with tscVersion = node <tscPath> --version (repo-pinned)', async () => {
    const r = await prepareBase(entry(), clone, stored, { repoRoot: ROOT, runner: new NodeProcessRunner(), env: buildChildEnv(process.env, ['PATH', 'HOME']) });
    if (!r.ok) throw new Error(r.detail);
    const base: PreparedBase = r.base; // compile-time assignability (tsc -p tsconfig.scripts.json)
    const tscPath = join(ROOT, 'node_modules/typescript/bin/tsc');
    expect(base.tscPath).toBe(tscPath);
    expect(base.tscVersion).toBe(parseTscVersion(execFileSync('node', [tscPath, '--version'], { encoding: 'utf8' })));
    expect(base).toMatchObject({ projectId: 'fixture-repo', baseKind: 'corpus', dir: clone, baseCommit: sha, tsconfigPath: 'tsconfig.json', specPath: 'corpus/specs/fixture-repo.yaml' });
    // OI-U5a-17: the overlaid file's content hash (what U5a's copyBase checks), not the patch-file hash
    expect(base.overlays).toEqual([{ path: 'src/config.ts', sha256: sha256Hex('export const PORT = 3000;\n') }]);
    const copied = await copyBase(base, join(mkdtempSync(join(work, 'copy-')), 'base'));
    expect(copied.success).toBe(true);
    expect(base.installLockSha256).toBeUndefined();
  });

  it('copies capped and judgeSelection from the stored baseline selection', async () => {
    const r = await prepareBase(entry(), clone, stored, { repoRoot: ROOT, runner: new NodeProcessRunner(), env: buildChildEnv(process.env, ['PATH', 'HOME']) });
    if (!r.ok) throw new Error(r.detail);
    expect(r.base.capped).toBe(true);
    expect(r.base.judgeSelection).toEqual([
      { template: 'architectural-integrity', functionId: 'FF-N01', capped: false, selectedFiles: ['src/app/user.service.ts', 'src/domain/user.entity.ts'] },
      { template: 'intent-alignment', functionId: 'FF-N02', capped: true, selectedFiles: ['src/app/user.service.ts', 'src/domain/user.entity.ts'] },
    ]);
    const fn0 = stored.functions[0];
    if (fn0 === undefined) throw new Error('fixture');
    expect(judgeSelectionOf({ ...stored, functions: [{ ...fn0, unitFiles: {} }] })).toMatchObject({ ok: false });
  });

  it('stops with PREP_SELECTION_MISSING without a stored selection, and with PREP_TSC_MISMATCH on a version drift', async () => {
    const o = { repoRoot: ROOT, runner: new NodeProcessRunner(), env: buildChildEnv(process.env, ['PATH', 'HOME']) };
    expect(await prepareBase(entry(), clone, undefined, o)).toMatchObject({ ok: false, code: PREP_SELECTION_MISSING });
    expect(await prepareBase(entry(), clone, { ...stored, projectId: 'other' }, o)).toMatchObject({ ok: false, code: PREP_SELECTION_MISSING });
    const drift = entry({ tsc: { kind: 'repo-pinned', tscPath: 'node_modules/typescript/bin/tsc', tscVersion: '4.7.4' } });
    expect(await prepareBase(drift, clone, stored, o)).toMatchObject({ ok: false, code: PREP_TSC_MISMATCH });
  });
});
