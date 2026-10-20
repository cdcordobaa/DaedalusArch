/**
 * Study 2b readiness-gate helpers: the post-run acceptance procedure (D12; scripts/v1.4/lib/post-run-acceptance.ts)
 * and the leakage scan (V11; scripts/v1.4/lib/leakage-scan.ts). Synthetic fixtures only; no sealed file is read.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { DELEG6_ENTRIES, DELEG8_ENTRIES, filePasses, passRate, resolveEntry, runPostRunAcceptance, stepPasses } from '../../../../scripts/v1.4/lib/post-run-acceptance';
import { indexFiles, jsonStrings, ngramHashes, scanRoot, words } from '../../../../scripts/v1.4/lib/leakage-scan';

const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'gate-checks-'));
const put = (root: string, rel: string, text = ''): void => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
};

describe('post-run acceptance entry rule (DELEG8 step 2)', () => {
  it('keeps DELEG6 list order, then the four src/presentation names', () => {
    expect([...DELEG6_ENTRIES]).toEqual(['src/main.ts', 'src/server.ts', 'src/index.ts', 'src/app.ts', 'main.ts', 'server.ts', 'index.ts']);
    expect([...DELEG8_ENTRIES]).toEqual(['src/presentation/server.ts', 'src/presentation/main.ts', 'src/presentation/app.ts', 'src/presentation/index.ts']);
  });
  it('takes package.json main first when it names an existing file under src/', () => {
    const d = tmp();
    put(d, 'package.json', JSON.stringify({ main: './src/presentation/app.ts' }));
    put(d, 'src/presentation/app.ts');
    put(d, 'src/main.ts');
    expect(resolveEntry(d)).toBe('src/presentation/app.ts');
  });
  it('ignores a main outside src/ or naming a missing file, and falls back to the lists in order', () => {
    const d = tmp();
    put(d, 'package.json', JSON.stringify({ main: 'dist/index.js' }));
    put(d, 'src/presentation/server.ts');
    put(d, 'index.ts');
    expect(resolveEntry(d)).toBe('index.ts');
    fs.rmSync(path.join(d, 'index.ts'));
    expect(resolveEntry(d)).toBe('src/presentation/server.ts');
    put(d, 'package.json', JSON.stringify({ main: 'src/missing.ts' }));
    expect(resolveEntry(d)).toBe('src/presentation/server.ts');
    put(d, 'package.json', JSON.stringify({ main: 'src/../../etc/passwd' }));
    expect(resolveEntry(d)).toBe('src/presentation/server.ts');
  });
  it('returns null when no entry exists', () => {
    const d = tmp();
    put(d, 'src/business/a.ts');
    expect(resolveEntry(d)).toBeNull();
  });
});

describe('post-run acceptance outcome (DELEG8 step 5)', () => {
  const f = (p: Partial<{ passed: number; failed: number; errors: number; timedOut: boolean }>) => ({ passed: 1, failed: 0, errors: 0, timedOut: false, ...p });
  it('a file passes iff no failure, no error and no time-out', () => {
    expect(filePasses(f({}))).toBe(true);
    expect(filePasses(f({ failed: 1 }))).toBe(false);
    expect(filePasses(f({ errors: 1 }))).toBe(false);
    expect(filePasses(f({ timedOut: true }))).toBe(false);
  });
  it('a step passes iff it ran and every file passes; build-failed and not-started fail; no-tests is null', () => {
    const ok = { file: 'a', sha256: 'x', ...f({}), pass: true };
    const bad = { ...ok, failed: 1, pass: false };
    expect(stepPasses('ran', [ok, ok])).toBe(true);
    expect(stepPasses('ran', [ok, bad])).toBe(false);
    expect(stepPasses('ran', [])).toBe(false);
    expect(stepPasses('build-failed', [ok])).toBe(false);
    expect(stepPasses('not-started', [ok])).toBe(false);
    expect(stepPasses('runner-error', [ok])).toBe(false);
    expect(stepPasses('no-tests', [])).toBeNull();
  });
  it('pass rate per cell counts failing statuses and skips no-tests', () => {
    const r = passRate([{ cell: 'a', pass: true }, { cell: 'a', pass: false }, { cell: 'a', pass: null }, { cell: 'b', pass: true }]);
    expect(r.a).toEqual({ steps: 2, passed: 1, rate: 0.5 });
    expect(r.b).toEqual({ steps: 1, passed: 1, rate: 1 });
  });
  it('a step with no test files is no-tests, and nothing is started', async () => {
    const acc = tmp();
    const rec = await runPostRunAcceptance({ materialise: () => { throw new Error('must not materialise'); }, task: 't', step: 1, acceptanceRoot: acc, nodeModules: acc, tsc: '/nonexistent', tsx: '/nonexistent', scratchRoot: os.tmpdir() });
    expect(rec.status).toBe('no-tests');
    expect(rec.pass).toBeNull();
  });
  it('a snapshot that fails the type-check is build-failed and counts as failing', async () => {
    const acc = tmp();
    put(acc, 't/step-01.test.mjs', 'export {};\n');
    const rec = await runPostRunAcceptance({ materialise: (into) => put(into, 'src/main.ts', 'x'), task: 't', step: 1, acceptanceRoot: acc, nodeModules: acc, tsc: '/usr/bin/false', tsx: '/nonexistent', scratchRoot: os.tmpdir() });
    expect(rec.status).toBe('build-failed');
    expect(rec.pass).toBe(false);
    expect(rec.files).toHaveLength(1);
  });
  it('a snapshot with no entry file is not-started and counts as failing', async () => {
    const acc = tmp();
    put(acc, 't/step-01.test.mjs', 'export {};\n');
    const rec = await runPostRunAcceptance({ materialise: (into) => put(into, 'src/business/a.ts', 'x'), task: 't', step: 1, acceptanceRoot: acc, nodeModules: acc, tsc: '/usr/bin/true', tsx: '/nonexistent', scratchRoot: os.tmpdir() });
    expect(rec.status).toBe('not-started');
    expect(rec.pass).toBe(false);
  });
});

describe('leakage scan (V11)', () => {
  const secret = 'The vendor ledger reconciles every pallet against the harbour manifest each night at closing time';
  it('normalises case, punctuation and JSON escapes into words', () => {
    expect(words('A\\nB, c"d')).toEqual(['a', 'b', 'c', 'd']);
    expect(jsonStrings({ a: ['x', { b: 'y' }], c: 1 })).toEqual(['x', 'y']);
  });
  it('finds a verbatim 8-word window, through JSON escaping, and nothing in unrelated text', () => {
    const sealedDir = tmp();
    put(sealedDir, 'tasks.json', JSON.stringify({ tasks: [{ steps: [{ request: secret }] }] }));
    const sealed = indexFiles([path.join(sealedDir, 'tasks.json')]);
    expect(sealed.ngrams.size).toBe(ngramHashes(secret).size);
    const scan = tmp();
    put(scan, 'clean.md', 'Nothing here resembles the sealed request at all, only ordinary words about layers.');
    put(scan, 'leak.json', JSON.stringify({ note: `prefix ${secret.split(' ').slice(2, 12).join(' ')} suffix` }));
    put(scan, 'copy/tasks.json', fs.readFileSync(path.join(sealedDir, 'tasks.json'), 'utf8'));
    const r = scanRoot(scan, 'x', sealed, new Set(), { skipDirs: [] });
    expect(r.filesWithHits).toBe(2);
    expect(r.wholeFileMatches).toBe(1);
    expect(r.hits.map((h) => h.file).sort()).toEqual(['copy/tasks.json', 'leak.json']);
  });
  it('counts a hit whose 8-gram is in the public baseline as explained', () => {
    const sealedDir = tmp();
    put(sealedDir, 'tasks.json', JSON.stringify({ s: secret }));
    const sealed = indexFiles([path.join(sealedDir, 'tasks.json')]);
    const scan = tmp();
    put(scan, 'a.md', secret);
    const r = scanRoot(scan, 'x', sealed, ngramHashes(secret), { skipDirs: [] });
    expect(r.filesWithHits).toBe(1);
    expect(r.filesWithUnexplainedHits).toBe(0);
  });
  it('skips the named directories', () => {
    const sealedDir = tmp();
    put(sealedDir, 'tasks.json', JSON.stringify({ s: secret }));
    const sealed = indexFiles([path.join(sealedDir, 'tasks.json')]);
    const scan = tmp();
    put(scan, 'node_modules/p/a.md', secret);
    expect(scanRoot(scan, 'x', sealed, new Set(), { skipDirs: ['node_modules'] }).filesWithHits).toBe(0);
  });
});
