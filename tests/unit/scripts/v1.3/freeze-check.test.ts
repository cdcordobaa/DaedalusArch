/**
 * The freeze check (scripts/v1.3/freeze-check.ts): its parsers, the dry run on the repository as it stands (every
 * answer missing), the answers and manifest checks with temporary files, and the engine probe (injected).
 * Nothing here reads a sealed directory.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  adrAccepted, adrSection, buildManifest, decisionAnswers, deferredRulesOf, parseFreezeArgs, renderChecks, renderManifest,
  runFreezeChecks, sealedRows, switchBlockOf,
} from '../../../../scripts/v1.3/lib/freeze-check.js';
import type { EngineProbe, FreezeOptions } from '../../../../scripts/v1.3/lib/freeze-check.js';
import type { GitRunner } from '../../../../scripts/v1.3/lib/holdout-run-main.js';
import { renderSwitchBlock } from '../../../../scripts/v1.3/lib/construct-answers.js';
import { STATUS_QUO_ANSWERS } from '../../../../src/shared/construct-switches.js';
import { CONSTRUCT_QUESTION_IDS } from '../../../../src/shared/construct-switch-catalogue.js';

const ROOT = path.resolve(__dirname, '../../../..');
const realGit: GitRunner = (args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
/** Real git, except that the working tree reads as clean (the test must not depend on uncommitted work). */
const cleanTreeGit: GitRunner = (args) => (args[0] === 'diff' || args[0] === 'status' ? '' : realGit(args));

let tmp: string;
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-freeze-test-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

function opts(over: Partial<FreezeOptions> = {}): FreezeOptions {
  const o = parseFreezeArgs(['--dry-run']);
  if (typeof o === 'string') throw new Error(o);
  return { ...o, repoRoot: ROOT, answers: path.join(tmp, 'absent.json'), manifest: path.join(tmp, 'manifest.json'), tests: path.join(tmp, 'tests.json'), ...over };
}

describe('parsers', () => {
  it('reads [Answer]: lines in page order', () => {
    expect(decisionAnswers('[Answer]: C\nx\n[Answer]:\n[Answer]: Option B - because\n[Answer]: D: x')).toEqual(['C', '', 'B', 'D']);
  });
  it('finds an ADR section and its status', () => {
    const t = '# x\n## ADR-V13-01: a\n**Status**: Accepted.\n## ADR-V13-03: b\n**Status**: Draft.\nQ3 C\n## ADR-V13-04\n';
    expect(adrSection(t, 'ADR-V13-03')).toBe('## ADR-V13-03: b\n**Status**: Draft.\nQ3 C\n');
    expect(adrAccepted(adrSection(t, 'ADR-V13-01') ?? '')).toBe(true);
    expect(adrAccepted(adrSection(t, 'ADR-V13-03') ?? '')).toBe(false);
    expect(adrSection(t, 'ADR-V13-02')).toBeUndefined();
  });
  it('reads sealed-hashes rows (sha256 and a 40-hex commit)', () => {
    const r = sealedRows(`| A | ${'a'.repeat(64)} | n |\n| v1.3 freeze commit X (tool) | ${'b'.repeat(40)} | n |\n| bad | xyz | n |`);
    expect([...r.entries()]).toEqual([['A', 'a'.repeat(64)], ['v1.3 freeze commit X (tool)', 'b'.repeat(40)]]);
  });
  it('the switch file today is the rendering of all-A answers without notes', () => {
    const block = switchBlockOf(fs.readFileSync(path.join(ROOT, 'src/shared/construct-switches.ts'), 'utf8'));
    expect(block).toBe(renderSwitchBlock(STATUS_QUO_ANSWERS));
  });
  it('FF-DS01 stays deferred unless Q15 is answered B', () => {
    expect(deferredRulesOf(STATUS_QUO_ANSWERS)).toEqual(['FF-DS01']);
    expect(deferredRulesOf({ ...STATUS_QUO_ANSWERS, Q15: 'B' })).toEqual([]);
  });
  it('rejects a dry run that would write', () => {
    expect(parseFreezeArgs(['--dry-run', '--write-manifest'])).toMatch(/writes nothing/);
    expect(parseFreezeArgs(['--bogus'])).toMatch(/unknown option/);
    expect(parseFreezeArgs([])).toMatchObject({ dryRun: false, probeEngine: true, commit: 'HEAD' });
  });
});

describe('runFreezeChecks', () => {
  it('dry run before any answer: names exactly the unmet preconditions', async () => {
    const r = await runFreezeChecks(opts(), { git: cleanTreeGit });
    const status = Object.fromEntries(r.checks.map((c) => [c.id, c.status]));
    expect(status).toEqual({
      F1: 'unmet', F2: 'unmet', F3: 'unmet', F4: 'unmet', F5: 'ok', F6: 'ok', F7: 'ok', F8: 'unmet', F9: 'unmet',
      F10: 'unmet', F11: 'unmet', F12: 'unmet', F13: 'ok', F14: 'skipped',
    });
    expect(renderChecks(r, true)).toMatch(/FREEZE PRECONDITIONS NOT MET: 9 of 14 unmet \(F1, F2, F3, F4, F8, F9, F10, F11, F12\)/);
    expect(r.checks.find((c) => c.id === 'F3')?.detail).toEqual(['Docs/v1.3/construct-decisions.md: [Answer]: empty for all 25 questions']);
    expect(r.manifest.deferredRules).toEqual(['FF-DS01']);
  }, 120_000);

  it('an all-A answers file passes F1 and F2; a different answer fails F2', async () => {
    const all = path.join(tmp, 'answers.json');
    fs.writeFileSync(all, JSON.stringify(Object.fromEntries(CONSTRUCT_QUESTION_IDS.map((q) => [q, 'A']))));
    let r = await runFreezeChecks(opts({ answers: all }), { git: cleanTreeGit });
    expect(r.checks.find((c) => c.id === 'F1')?.status).toBe('ok');
    expect(r.checks.find((c) => c.id === 'F2')?.status).toBe('ok');
    expect(r.manifest.deferredRules).toEqual(['FF-DS01']);
    fs.writeFileSync(all, JSON.stringify({ ...Object.fromEntries(CONSTRUCT_QUESTION_IDS.map((q) => [q, 'A'])), Q3: 'C' }));
    r = await runFreezeChecks(opts({ answers: all }), { git: cleanTreeGit });
    expect(r.checks.find((c) => c.id === 'F2')?.detail[0]).toMatch(/differs from the rendering/);
    expect(r.checks.find((c) => c.id === 'F4')?.detail.join(' ')).toMatch(/no "## ADR-V13-03" section/);
  }, 120_000);

  it('the manifest is deterministic, and F10 compares it byte for byte', async () => {
    const a = await buildManifest(ROOT, cleanTreeGit, 'HEAD', path.join(tmp, 'absent.json'));
    const b = await buildManifest(ROOT, cleanTreeGit, 'HEAD', path.join(tmp, 'absent.json'));
    expect(renderManifest(a)).toBe(renderManifest(b));
    expect(Object.keys(a.compiled)).toEqual(['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd']);
    expect(a.files['presets/ddd.yaml']).toMatch(/^[0-9a-f]{64}$/);
    expect(a.tiers.layered?.['FF-S03']).toBe('blocking');
    const m = path.join(tmp, 'manifest.json');
    fs.writeFileSync(m, renderManifest(a));
    let r = await runFreezeChecks(opts({ manifest: m }), { git: cleanTreeGit });
    expect(r.checks.find((c) => c.id === 'F10')?.status).toBe('ok');
    fs.writeFileSync(m, renderManifest({ ...a, files: { ...a.files, 'presets/ddd.yaml': '0'.repeat(64) } }));
    r = await runFreezeChecks(opts({ manifest: m }), { git: cleanTreeGit });
    expect(r.checks.find((c) => c.id === 'F10')?.detail[0]).toMatch(/not byte-identical.*files presets\/ddd\.yaml/);
  }, 180_000);

  it('probes the engine: Neo4j 5.26 with APOC passes, another version or no APOC fails, no credentials fail', async () => {
    const run = async (env: NodeJS.ProcessEnv, probe: EngineProbe): Promise<{ status: string; detail: readonly string[] } | undefined> =>
      (await runFreezeChecks(opts({ probeEngine: true }), { git: cleanTreeGit, env, probe })).checks.find((c) => c.id === 'F14');
    const env = { NEO4J_URI: 'bolt://127.0.0.1:7687', NEO4J_PASSWORD: 'secret' };
    expect(await run(env, () => Promise.resolve({ name: 'Neo4j Kernel', version: '5.26.24', edition: 'community', apoc: '5.26.24' }))).toMatchObject({ status: 'ok' });
    expect((await run(env, () => Promise.resolve({ name: 'Neo4j Kernel', version: '5.20.0', edition: 'community', apoc: null })))?.detail).toEqual([
      'Neo4j 5.20.0 (community); the reference engine is 5.26.x', 'APOC is not installed',
    ]);
    const failing = await run(env, () => Promise.reject(new Error('auth failed for secret')));
    expect(failing?.detail[0]).toBe('cannot reach Neo4j: auth failed for ***');
    expect((await run({}, () => Promise.reject(new Error('unused'))))?.detail).toEqual(['NEO4J_URI and NEO4J_PASSWORD are not set']);
  }, 180_000);
});
