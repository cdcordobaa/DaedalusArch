/**
 * ADR-021 SO1-E and X-7: SO1 metrics (validator first-pass rate, template coverage per library, spec line counts).
 * Pure rules on hand-computed fixtures; the producer on a temp git repository with specs built from this checkout's
 * presets.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  compiledShares, countSpecLines, errorCodes, failureCodeCounts, hasTemplate, libraryCoverage, passRate, so1Metrics, summarise,
} from '../../../../scripts/lib/so1-metrics.js';
import type { DeclaredFunction, SpecRecord, ValidationOutcome } from '../../../../scripts/lib/so1-metrics.js';
import { builtInCoverage, computeSo1Metrics, main, specGroupOf, validateSpecText } from '../../../../scripts/so1-metrics.js';
import { ROOT } from '../u5b/score-fixture.js';

const LAYERED = readFileSync(join(ROOT, 'presets/layered.yaml'), 'utf8');
const CLEAN = readFileSync(join(ROOT, 'presets/clean-architecture.yaml'), 'utf8');
const BAD_REF = CLEAN.replace('name: dependency-direction', 'name: no-such-template');

const outcome = (over: Partial<ValidationOutcome> = {}): ValidationOutcome => ({
  pass: true, errors: [], style: 'nestjs', declared: 27, compiled: 26, disabled: 1, ...over,
});
const rec = (path: string, over: Partial<SpecRecord> = {}): SpecRecord => ({
  path, group: 'corpus', sha256: '0'.repeat(64), firstCommit: null, revisions: 0,
  lines: { total: 0, blank: 0, comment: 0, content: 0 }, first: outcome(), current: outcome(), ...over,
});

describe('line counts (X-7)', () => {
  it('counts total, blank, comment-only and content lines', () => {
    expect(countSpecLines('a: 1\n\n# c\n  # d\nb: 2 # x\n')).toEqual({ total: 5, blank: 1, comment: 2, content: 2 });
    expect(countSpecLines('')).toEqual({ total: 0, blank: 0, comment: 0, content: 0 });
    expect(countSpecLines('a')).toEqual({ total: 1, blank: 0, comment: 0, content: 1 });
    expect(countSpecLines('a\r\n\r\n')).toEqual({ total: 2, blank: 1, comment: 0, content: 1 });
    expect(countSpecLines('  \n\t\n')).toEqual({ total: 2, blank: 2, comment: 0, content: 0 });
  });

  it('summarises n, min, median, mean, max', () => {
    expect(summarise([3, 1, 2])).toEqual({ n: 3, min: 1, median: 2, mean: 2, max: 3 });
    expect(summarise([4, 1, 3, 2])).toEqual({ n: 4, min: 1, median: 2.5, mean: 2.5, max: 4 });
    expect(summarise([])).toBeNull();
  });
});

describe('first-pass rate (SO1-E)', () => {
  it('3 of 4 → 0.75 with the Wilson 95 % interval (0.3006, 0.9544)', () => {
    const r = passRate([true, false, true, true]);
    expect(r).toMatchObject({ n: 4, passed: 3, rate: 0.75 });
    expect(r.wilson95?.low).toBeCloseTo(0.3006, 4);
    expect(r.wilson95?.high).toBeCloseTo(0.9544, 4);
    expect(passRate([])).toEqual({ n: 0, passed: 0, rate: null, wilson95: null });
  });

  it('failure codes are counted once per failing spec; passing specs add none', () => {
    const a = outcome({ pass: false, errors: ['[A] x', '[A] y', '[B] z'] });
    expect(errorCodes(a)).toEqual(['A', 'B']);
    expect(failureCodeCounts([a, outcome({ pass: false, errors: ['plain'] }), outcome({ errors: ['[C] warned'] })])).toEqual({ A: 1, B: 1, UNCODED: 1 });
  });
});

describe('template coverage (SO1-E)', () => {
  const cypher = (n: string): boolean => n === 'known';
  const fn = (id: string, name: string, route: DeclaredFunction['route'], hasRubric: boolean): DeclaredFunction => ({ id, name, route, hasRubric });

  it('a template is a Cypher template (symbolic), a rubric (neuronal), or both (hybrid)', () => {
    expect(hasTemplate(fn('a', 'known', 'symbolic', false), cypher)).toBe(true);
    expect(hasTemplate(fn('a', 'unknown', 'symbolic', true), cypher)).toBe(false);
    expect(hasTemplate(fn('a', 'unknown', 'neuronal', true), cypher)).toBe(true);
    expect(hasTemplate(fn('a', 'known', 'neuronal', false), cypher)).toBe(false);
    expect(hasTemplate(fn('a', 'known', 'hybrid', true), cypher)).toBe(true);
    expect(hasTemplate(fn('a', 'known', 'hybrid', false), cypher)).toBe(false);
  });

  it('library share = with template ÷ declared, missing ids sorted', () => {
    const fns = [fn('F-3', 'unknown', 'symbolic', false), fn('F-1', 'known', 'symbolic', false), fn('F-2', 'x', 'neuronal', true), fn('F-0', 'x', 'neuronal', false)];
    expect(libraryCoverage('s', fns, cypher)).toEqual({ style: 's', declared: 4, withTemplate: 2, share: 0.5, withoutTemplate: ['F-0', 'F-3'] });
    expect(libraryCoverage('e', [], cypher)).toEqual({ style: 'e', declared: 0, withTemplate: 0, share: null, withoutTemplate: [] });
  });

  it('every built-in library: 27 declared, all with a template', () => {
    const libs = builtInCoverage();
    expect(libs.map((l) => l.style).sort()).toEqual(['clean-architecture', 'layered', 'nestjs']);
    for (const l of libs) expect(l).toMatchObject({ declared: 27, withTemplate: 27, share: 1, withoutTemplate: [] });
  });

  it('compiled ÷ declared is a ratio of sums per (group, style); non-compiling specs are left out', () => {
    const rows = compiledShares([
      rec('a', { current: outcome({ declared: 27, compiled: 26, disabled: 1 }) }),
      rec('b', { current: outcome({ declared: 27, compiled: 18, disabled: 9 }) }),
      rec('c', { current: outcome({ style: null, declared: 10, compiled: 10, disabled: 0 }) }),
      rec('d', { current: outcome({ pass: false, compiled: null, disabled: null }) }),
      rec('e', { group: 'preset', current: outcome({ style: 'layered', declared: 27, compiled: 18, disabled: 9 }) }),
    ]);
    expect(rows.map(({ compiledShare, ...r }) => ({ ...r, share: compiledShare === null ? null : Number(compiledShare.toFixed(6)) }))).toEqual([
      { group: 'corpus', style: 'nestjs', specs: 2, declared: 54, compiled: 44, disabled: 10, share: 0.814815 },
      { group: 'corpus', style: 'none', specs: 1, declared: 10, compiled: 10, disabled: 0, share: 1 },
      { group: 'preset', style: 'layered', specs: 1, declared: 27, compiled: 18, disabled: 9, share: 0.666667 },
    ]);
  });

  it('the SO1 table sorts specs by path and has one row per group, empty groups included', () => {
    const m = so1Metrics('c0', [rec('z', { first: outcome({ pass: false, errors: ['[X] e'] }) }), rec('a', { group: 'fixture', lines: { total: 4, blank: 1, comment: 1, content: 2 } })], []);
    expect(m.specs.map((s) => s.path)).toEqual(['a', 'z']);
    expect(m.groups.map((g) => g.group)).toEqual(['corpus', 'fixture', 'preset']);
    expect(m.groups[0]).toMatchObject({ firstPass: { n: 1, passed: 0, rate: 0 }, currentPass: { n: 1, passed: 1 }, firstFailureCodes: { X: 1 } });
    expect(m.groups[1]?.contentLines).toEqual({ n: 1, min: 2, median: 2, mean: 2, max: 2 });
    expect(m.groups[2]).toMatchObject({ firstPass: { n: 0, rate: null }, contentLines: null, firstFailureCodes: {} });
  });
});

describe('validate check on a spec text', () => {
  it('the layered preset passes: declared 27, compiled 18, disabled 9 (project-directory checks left out)', async () => {
    expect(await validateSpecText(LAYERED)).toEqual({ pass: true, errors: [], style: 'layered', declared: 27, compiled: 18, disabled: 9 });
  });

  it('an unknown template name fails with INVALID_TEMPLATE_REF; a schema failure has no counts', async () => {
    const bad = await validateSpecText(BAD_REF);
    expect(bad.pass).toBe(false);
    expect(errorCodes(bad)).toContain('INVALID_TEMPLATE_REF');
    expect(await validateSpecText('spec_version: "1.0.0"\n')).toMatchObject({ pass: false, style: null, declared: null, compiled: null });
  });

  it('groups follow the BR-U5b-51 patterns', () => {
    expect(specGroupOf('corpus/specs/x.yaml')).toBe('corpus');
    expect(specGroupOf('specs/clean-arch.yaml')).toBe('fixture');
    expect(specGroupOf('tests/fixtures/u5a/layered/firewall.spec.yaml')).toBe('fixture');
    expect(specGroupOf('presets/layered.yaml')).toBe('preset');
    expect(specGroupOf('specs/daedalus-arch.yaml')).toBeNull();
    expect(specGroupOf('corpus/specs/n/x.yaml')).toBeNull();
  });
});

describe('producer on a temp git repository', () => {
  let repo = '';
  const git = (args: readonly string[]): string => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd: repo, encoding: 'utf8' }).trim();
  const put = (path: string, text: string): void => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  };

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'u6-so1-'));
    git(['init', '-q']);
    put('corpus/specs/a.yaml', BAD_REF);
    put('specs/clean-arch.yaml', CLEAN);
    put('presets/layered.yaml', LAYERED);
    put('specs/other.yaml', LAYERED);
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'first']);
    put('corpus/specs/a.yaml', LAYERED);
    git(['add', '-A']);
    git(['commit', '-q', '-m', 'fix a']);
  });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  it('first version vs current version, revisions and group rates', async () => {
    const m = await computeSo1Metrics(repo);
    expect(m.commit).toBe(git(['rev-parse', 'HEAD']));
    expect(m.specs.map((s) => [s.path, s.group, s.revisions, s.first.pass, s.current.pass])).toEqual([
      ['corpus/specs/a.yaml', 'corpus', 2, false, true],
      ['presets/layered.yaml', 'preset', 1, true, true],
      ['specs/clean-arch.yaml', 'fixture', 1, true, true],
    ]);
    const a = m.specs[0];
    expect(a?.firstCommit).toBe(git(['rev-list', '--max-parents=0', 'HEAD']));
    expect(a?.lines).toEqual(countSpecLines(LAYERED));
    expect(m.groups[0]).toMatchObject({ group: 'corpus', firstPass: { n: 1, passed: 0, rate: 0 }, currentPass: { n: 1, passed: 1, rate: 1 }, firstFailureCodes: { INVALID_TEMPLATE_REF: 1 } });
    expect(m.compiledShares).toEqual(expect.arrayContaining([expect.objectContaining({ group: 'corpus', style: 'layered', declared: 27, compiled: 18 })]));
  });

  it('CLI body: --out writes the same canonical bytes twice; bad args exit 2; --self-test exits 1', async () => {
    const io = { out: (): void => undefined, err: (): void => undefined, writeFile: (f: string, t: string): void => { writeFileSync(f, t); } };
    expect(await main(['--out', 'm1.json'], repo, io)).toBe(0);
    expect(await main(['--out', 'm2.json'], repo, io)).toBe(0);
    const text = readFileSync(join(repo, 'm1.json'), 'utf8');
    expect(readFileSync(join(repo, 'm2.json'), 'utf8')).toBe(text);
    expect(text).not.toContain(repo);
    expect(await main(['--nope'], repo, io)).toBe(2);
    expect(await main(['--self-test'], repo, io)).toBe(1);
  });
});
