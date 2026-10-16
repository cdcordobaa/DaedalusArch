/**
 * The hold-out runner (scripts/v1.3/holdout-run.ts): arguments, the structure check (dry run), the rule-id map, the
 * location and freeze checks, and the live and from-raw paths with an injected child spawner and git. The hold-out
 * directories here are temporary copies of DEVELOPMENT reference styles (a stand-in); no sealed data exists in the
 * repository or is read.
 */
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  checkStructure, determinismDiff, freezeCheck, holdoutMain, locationProblems, parseHoldoutArgs, treeSha256,
} from '../../../../scripts/v1.3/lib/holdout-run-main.js';
import type { GitRunner, NodeSpawner } from '../../../../scripts/v1.3/lib/holdout-run-main.js';
import { applyRuleIdMap, loadReference, loadRuleIdMap } from '../../../../scripts/v1.3/lib/reference-model.js';

const ROOT = path.resolve(__dirname, '../../../..');
const DEV = path.join(ROOT, 'tests/fixtures/v1.3-reference');
const RUN = path.join(ROOT, 'results/v1.3-reference/after-member-facts');

let tmp: string;
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v13-holdout-test-'));
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function holdoutCopy(styles: readonly string[]): string {
  const dir = path.join(tmp, 'holdout');
  for (const s of styles) fs.cpSync(path.join(DEV, s), path.join(dir, s), { recursive: true });
  return dir;
}

function io(): { out: string[]; err: string[]; io: { env: NodeJS.ProcessEnv; out: (t: string) => void; err: (t: string) => void } } {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, io: { env: { NEO4J_URI: 'bolt://user:pw@localhost:7687', NEO4J_PASSWORD: 'pw' }, out: (t) => out.push(t), err: (t) => err.push(t) } };
}

const cleanGit: GitRunner = (args) => {
  if (args[0] === 'rev-parse') return `${'a'.repeat(40)}\n`;
  return '';
};

/** Rewrites FF-DT01 to the provisional FF-D01 in a copied DDD hold-out (the copy only). */
function provisionalDdd(dir: string): void {
  const v = path.join(dir, 'ddd', 'variants', 'v01-aggregate-boundary');
  for (const f of ['expected-findings.json', 'variant.json']) {
    const p = path.join(v, f);
    fs.writeFileSync(p, fs.readFileSync(p, 'utf8').replace(/FF-DT01/g, 'FF-D01'));
  }
}

describe('parseHoldoutArgs', () => {
  it('needs a hold-out, and a commit and an output directory unless it is a dry run', () => {
    expect(parseHoldoutArgs(['--dry-run', '--holdout', 'h'])).toMatchObject({ mode: 'dry-run', holdout: 'h', correctness: true, standIn: false, deferred: [] });
    expect(parseHoldoutArgs(['--holdout', 'h', '--out', 'o'])).toMatch(/--commit/);
    expect(parseHoldoutArgs(['--holdout', 'h', '--commit', 'x'])).toMatch(/--out/);
    expect(parseHoldoutArgs(['--commit', 'x'])).toMatch(/--holdout/);
    expect(parseHoldoutArgs(['--holdout', 'h', '--commit', 'x', '--out', 'o', '--from-raw', 'r', '--deferred', 'FF-DS01', '--no-correctness', '--style', 'ddd'])).toMatchObject({
      mode: 'from-raw', fromRaw: 'r', deferred: ['FF-DS01'], correctness: false, styles: ['ddd'],
    });
    expect(parseHoldoutArgs(['--holdout', 'h', '--dry-run', '--from-raw', 'r'])).toMatch(/choose one/);
    expect(parseHoldoutArgs(['--holdout', 'h', '--dry-run', '--style', 'onion'])).toMatch(/--style/);
    expect(parseHoldoutArgs(['--holdout', 'h', '--dry-run', '--deferred', 'DS01'])).toMatch(/--deferred/);
    expect(parseHoldoutArgs(['--holdout', 'h', '--dry-run', '--expect-sha256', 'abc'])).toMatch(/64 hex/);
    expect(parseHoldoutArgs(['--holdout', 'h', '--dry-run', '--bogus', 'x'])).toMatch(/unknown option/);
  });
});

describe('location and tree hash', () => {
  it('refuses a hold-out inside the repository or under node_modules', () => {
    expect(locationProblems(DEV, ROOT)).toHaveLength(1);
    expect(locationProblems(tmp, ROOT)).toEqual([]);
    const nm = path.join(tmp, 'node_modules', 'h');
    fs.mkdirSync(nm, { recursive: true });
    expect(locationProblems(nm, ROOT)[0]).toMatch(/node_modules/);
  });

  it('hashes the tree as find | sort | sha256sum does', () => {
    const d = path.join(tmp, 't');
    fs.mkdirSync(path.join(d, 'b'), { recursive: true });
    fs.writeFileSync(path.join(d, 'a.txt'), 'one\n');
    fs.writeFileSync(path.join(d, 'b', 'c.json'), '{}\n');
    const shell = execSync('(find . -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum) | sha256sum', { cwd: d, encoding: 'utf8' }).split(' ')[0];
    expect(treeSha256(d)).toEqual({ sha256: shell, files: 2 });
  });
});

describe('checkStructure (dry run)', () => {
  it('accepts the development set only as a stand-in, and counts N_PER_STYLE', () => {
    expect(checkStructure(ROOT, { holdout: DEV, standIn: false, deferred: [] }).problems[0]).toMatch(/inside the repository/);
    const r = checkStructure(ROOT, { holdout: DEV, standIn: true, deferred: ['FF-DS01'] });
    expect(r.problems).toEqual([]);
    expect(r.styles.map((s) => s.style)).toEqual(['clean-architecture', 'layered', 'nestjs', 'hexagonal', 'ddd']);
    expect(r.styles.find((s) => s.style === 'layered')).toMatchObject({ format: 'patch', expectedBlocking: 11, variants: { violation: 9, nearMiss: 3, clean: 1 } });
    expect(r.warnings.some((w) => w.includes('cannot pass below n = 35'))).toBe(true);
  }, 60_000);

  it('reports missing styles and files, an unexpected hash, and a patch that does not apply', () => {
    const h = holdoutCopy(['layered']);
    fs.rmSync(path.join(h, 'layered', 'expected-graph.json'));
    let r = checkStructure(ROOT, { holdout: h, standIn: false, deferred: [], styles: ['layered', 'nestjs'], expectSha256: '0'.repeat(64) });
    expect(r.problems.join('\n')).toMatch(/does not match --expect-sha256/);
    expect(r.problems.join('\n')).toMatch(/layered: missing expected-graph.json/);
    expect(r.problems.join('\n')).toMatch(/nestjs: no directory/);
    expect(r.warnings.join('\n')).toMatch(/styles absent from the hold-out: clean-architecture, nestjs, hexagonal, ddd/);
    fs.cpSync(path.join(DEV, 'layered', 'expected-graph.json'), path.join(h, 'layered', 'expected-graph.json'));
    const patch = path.join(h, 'layered', 'variants', 'v02-service-renders-view', 'variant.patch');
    fs.writeFileSync(patch, fs.readFileSync(patch, 'utf8').replace(/^-.*$/m, '-this line is not in the file'));
    r = checkStructure(ROOT, { holdout: h, standIn: false, deferred: [] });
    expect(r.problems.join('\n')).toMatch(/v02-service-renders-view: does not materialise/);
  }, 60_000);

  it('needs an id map for provisional DDD ids, and accepts them with one', () => {
    const h = holdoutCopy(['ddd']);
    provisionalDdd(h);
    const without = checkStructure(ROOT, { holdout: h, standIn: false, deferred: [] });
    expect(without.problems.join('\n')).toMatch(/rule ids not in the frozen spec: FF-D01 \(provisional ids\? give --id-map\)/);
    const map = path.join(tmp, 'map.json');
    fs.writeFileSync(map, JSON.stringify({ schemaVersion: 1, styles: { ddd: { 'FF-D01': 'FF-DT01', 'FF-D09': 'FF-DT02' } } }));
    const withMap = checkStructure(ROOT, { holdout: h, standIn: false, deferred: [], idMap: map });
    expect(withMap.problems).toEqual([]);
    expect(withMap.styles[0]?.mappedIds).toEqual({ 'FF-D01 -> FF-DT01': 1 });
    expect(withMap.warnings.join('\n')).toMatch(/id-map entry FF-D09 matched no manifest finding/);
    expect(withMap.refs[0]?.variants.find((v) => v.manifest.variant === 'v01-aggregate-boundary')?.manifest.plants).toBe('FF-DT01');
  }, 60_000);
});

describe('rule-id map', () => {
  it('maps ids and, when a provisional name is given, checks and replaces it', () => {
    const ref = loadReference(ROOT, 'ddd');
    const file = path.join(tmp, 'm.json');
    fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, styles: { ddd: { 'FF-DT01': { ruleId: 'FF-DT02', name: 'aggregate-boundary' } } } }));
    const { ref: mapped, mapped: counts } = applyRuleIdMap(ref, loadRuleIdMap(file));
    const v = mapped.variants.find((x) => x.manifest.variant === 'v01-aggregate-boundary');
    expect(v?.manifest.expectedFindings[0]).toMatchObject({ ruleId: 'FF-DT02', ruleName: 'repository-aggregate-root' });
    expect(counts).toEqual({ 'FF-DT01 -> FF-DT02': 1 });
    fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, styles: { ddd: { 'FF-DT01': { ruleId: 'FF-DT02', name: 'other-name' } } } }));
    expect(() => applyRuleIdMap(ref, loadRuleIdMap(file))).toThrow(/the map expects other-name/);
    fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, styles: { onion: {} } }));
    expect(() => loadRuleIdMap(file)).toThrow(/unknown style onion/);
    fs.writeFileSync(file, JSON.stringify({ styles: {} }));
    expect(() => loadRuleIdMap(file)).toThrow(/not a rule-id map/);
    expect(applyRuleIdMap(ref, undefined).ref).toBe(ref);
  });
});

describe('freezeCheck', () => {
  it('passes a clean tree and names the diff and untracked files otherwise', () => {
    expect(freezeCheck(cleanGit, 'HEAD')).toEqual({ sha: 'a'.repeat(40), head: 'a'.repeat(40), problems: [] });
    const dirty: GitRunner = (args) => (args[0] === 'rev-parse' ? 'b'.repeat(40) : args[0] === 'diff' ? 'scripts/x.ts\n' : '?? src/new.ts\n M src/y.ts\n');
    const r = freezeCheck(dirty, 'b');
    expect(r.problems[0]).toMatch(/differs from bbbbbbbbbbbb in the frozen paths: scripts\/x.ts/);
    expect(r.problems[1]).toMatch(/untracked files in the frozen paths: src\/new.ts/);
    const missing: GitRunner = () => { throw new Error('bad'); };
    expect(freezeCheck(missing, 'nope').problems[0]).toMatch(/not a commit/);
  });
});

describe('holdoutMain', () => {
  it('a dry run prints the structure and never spawns', async () => {
    const t = io();
    const spawnNode: NodeSpawner = () => { throw new Error('must not run'); };
    const code = await holdoutMain(['--dry-run', '--holdout', holdoutCopy(['layered'])], ROOT, t.io, { spawnNode });
    expect(code).toBe(0);
    expect(t.out.join('')).toMatch(/layered: patch format; 9 violation, 3 near-miss, 1 clean/);
    expect(t.out.join('')).toMatch(/structure: ok/);
  }, 60_000);

  it('the live path refuses a dirty tree, needs Neo4j, runs the prespec pipeline and scores it', async () => {
    const h = holdoutCopy(['layered']);
    const out = path.join(tmp, 'run-1');
    const dirty: GitRunner = (args) => (args[0] === 'rev-parse' ? 'c'.repeat(40) : args[0] === 'diff' ? 'src/a.ts' : '');
    let t = io();
    expect(await holdoutMain(['--holdout', h, '--commit', 'HEAD', '--out', out], ROOT, t.io, { git: dirty })).toBe(1);
    expect(t.err.join('')).toMatch(/freeze: the working tree differs/);

    t = io();
    expect(await holdoutMain(['--holdout', h, '--commit', 'HEAD', '--out', out], ROOT, { ...t.io, env: {} }, { git: cleanGit })).toBe(2);

    // The spawner plays ue-baseline-live.ts and ue-graph.ts by copying a saved development run.
    const calls: string[][] = [];
    const spawnNode: NodeSpawner = (args) => {
      calls.push([...args]);
      const o = args[args.indexOf('--out') + 1] ?? '';
      if (args.includes('scripts/v1.3/ue-baseline-live.ts')) {
        for (const d of ['raw', 'evidence']) fs.cpSync(path.join(RUN, d, 'layered'), path.join(o, d, 'layered'), { recursive: true });
      } else {
        fs.mkdirSync(path.join(o, 'graph'), { recursive: true });
        fs.copyFileSync(path.join(RUN, 'graph', 'tool-graphs.json'), path.join(o, 'graph', 'tool-graphs.json'));
      }
      return 0;
    };
    t = io();
    const code = await holdoutMain(['--holdout', h, '--commit', 'HEAD', '--out', out, '--no-correctness'], ROOT, t.io, { git: cleanGit, spawnNode, now: () => new Date('2026-10-15T12:00:00Z') });
    expect(code).toBe(0);
    expect(calls[0]).toEqual(['--import', 'tsx', 'scripts/v1.3/ue-baseline-live.ts', '--root', h, '--out', out, '--style', 'layered']);
    expect(calls[1]?.[2]).toBe('scripts/v1.3/ue-graph.ts');
    expect(t.out.join('')).toMatch(/layered: validated at point estimate \(M1 blocking recall: validated at point estimate; M2 blocking precision: validated at point estimate; M7 import-edge recall: validated at point estimate/);
    const md = fs.readFileSync(path.join(out, 'holdout-scores.md'), 'utf8');
    expect(md).toMatch(/^# v1.3 hold-out run: scores/);
    expect(md).toContain('1.000 (11/11)');
    const prov = JSON.parse(fs.readFileSync(path.join(out, 'holdout-run-provenance.json'), 'utf8')) as Record<string, unknown>;
    expect(prov).toMatchObject({ standIn: false, mode: 'live', commit: 'a'.repeat(40), neo4j: 'bolt://localhost:7687', started: '2026-10-15T12:00:00.000Z' });
    expect(JSON.stringify(prov)).not.toContain('pw');

    // The hold-out is run once: a second live run into the same directory is refused.
    t = io();
    expect(await holdoutMain(['--holdout', h, '--commit', 'HEAD', '--out', out], ROOT, t.io, { git: cleanGit, spawnNode })).toBe(1);
    expect(t.err.join('')).toMatch(/run once/);
  }, 120_000);

  it('from-raw scores a saved run with the correctness check, and flags a non-identical repeat', async () => {
    const h = holdoutCopy(['layered']);
    const out = path.join(tmp, 'rescore');
    const t = io();
    const spawnNode: NodeSpawner = () => { throw new Error('must not run'); };
    const code = await holdoutMain(['--holdout', h, '--commit', 'HEAD', '--from-raw', RUN, '--out', out, '--development-stand-in', '--determinism', RUN], ROOT, t.io, { git: cleanGit, spawnNode });
    expect(code).toBe(0);
    const md = fs.readFileSync(path.join(out, 'holdout-scores.md'), 'utf8');
    expect(md).toMatch(/^# DEVELOPMENT-SET STAND-IN/);
    expect(md).toContain('Determinism repeat: identical raw rows');
    expect(md).toMatch(/\| layered \| M3 blocking precision \(correct\) \| 1\.000 \(11\/11\)/);
    expect(fs.existsSync(path.join(out, 'correctness', 'correctness.json'))).toBe(true);

    const other = path.join(tmp, 'run-2');
    fs.cpSync(path.join(RUN, 'raw', 'layered'), path.join(other, 'raw', 'layered'), { recursive: true });
    const f = path.join(other, 'raw', 'layered', 'clean.json');
    const j = JSON.parse(fs.readFileSync(f, 'utf8')) as { findings: unknown[] };
    j.findings.push({ ruleId: 'FF-S01', file: 'src/x.ts' });
    fs.writeFileSync(f, JSON.stringify(j));
    const refs = checkStructure(ROOT, { holdout: h, standIn: false, deferred: [] }).refs;
    expect(determinismDiff(RUN, other, refs)).toEqual(['layered/clean']);
  }, 180_000);
});
