/**
 * ADR-030: the mechanical spec to dependency-cruiser translation (T1..T10) and the comparison scoring helpers of
 * the tool-comparison and real-pairs experiments. Hand-computed fixtures; no dependency-cruiser run, no Neo4j.
 */
import { resolve } from 'node:path';
import picomatch from 'picomatch';
import {
  globRegex, normaliseTarget, packageRegex, TRANSLATED_FUNCTIONS, translateSpec, UNTRANSLATABLE,
} from '../../../scripts/depcruise-translate.js';
import {
  canonicalCycle, daFindings, depcruiseFindings, detects, findingKey, newFindings, scorePair, twinFires, wilson,
} from '../../../scripts/tool-comparison.js';
import type { Finding, ManifestRow } from '../../../scripts/tool-comparison.js';

const ROOT = resolve(__dirname, '../../..');

describe('T1 glob translation (picomatch-equivalent, safe-regex friendly)', () => {
  const globs = ['**/domain/**', 'src/domain/**', '**/*.entity.ts', 'src/**/x/*.ts', 'test/**', '**/*.module.ts', 'src/a.ts', '**'];
  const paths = [
    'domain/a.ts', 'src/domain/a.ts', 'src/domain', 'src/domainx/a.ts', 'src/x/domain/b/c.ts', 'a.entity.ts', 'src/u/user.entity.ts',
    'src/user.entity.tsx', 'src/x/a.ts', 'src/q/r/x/a.ts', 'src/x/b/a.ts', 'test/a.ts', 'tests/a.ts', 'src/test/a.ts', 'app.module.ts',
    'src/a.ts', 'src/a.tsx', 'x/src/a.ts', '.hidden/domain/a.ts',
  ];
  it.each(globs)('%s matches exactly the paths picomatch matches', (g) => {
    const pm = picomatch(g, { dot: true });
    const re = new RegExp(globRegex(g));
    for (const p of paths) expect([p, re.test(p)]).toEqual([p, pm(p)]);
  });
  it('writes no nested repetition (dependency-cruiser safe-regex)', () => {
    expect(globRegex('**/domain/**')).toBe('(?:^|\\/)domain(?:\\/|$)');
    expect(globRegex('src/**/x/*.ts')).toBe('^src\\/(?:|.*\\/)x\\/[^/]*\\.ts$');
  });
  it('refuses glob syntax it does not translate', () => {
    expect(() => globRegex('src/{a,b}/**')).toThrow(/only globstar/);
  });
});

describe('T5 packages and target normalisation', () => {
  it('matches resolved, @types and unresolved forms of a forbidden package, not a project path', () => {
    const re = new RegExp(packageRegex('express'));
    expect(re.test('node_modules/express/index.js')).toBe(true);
    expect(re.test('node_modules/@types/express/index.d.ts')).toBe(true);
    expect(re.test('express')).toBe(true);
    expect(re.test('express-session')).toBe(false);
    expect(re.test('src/express/a.ts')).toBe(false);
    const scoped = new RegExp(packageRegex('@nestjs/*'));
    expect(scoped.test('node_modules/@nestjs/common/index.js')).toBe(true);
    expect(scoped.test('@nestjs/core')).toBe(true);
  });
  it('normalises a node_modules path to its package name', () => {
    expect(normaliseTarget('node_modules/typeorm/index.js')).toBe('typeorm');
    expect(normaliseTarget('node_modules/@types/express/index.d.ts')).toBe('express');
    expect(normaliseTarget('node_modules/@nestjs/common/index.js')).toBe('@nestjs/common');
    expect(normaliseTarget('src/a/b.ts')).toBe('src/a/b.ts');
    expect(normaliseTarget('typeorm')).toBe('typeorm');
  });
});

describe('T2..T10 translation of corpus specs', () => {
  it('nestjs spec: S01, S02, S04, P01, C04 translated; S03 inactive by style; the rest untranslatable', async () => {
    const t = await translateSpec(resolve(ROOT, 'corpus/specs/realworld-test.yaml'));
    expect(t.translated.map((x) => x.functionId).sort()).toEqual(['FF-C04', 'FF-P01', 'FF-S01', 'FF-S02', 'FF-S04']);
    expect(t.skipped.find((s) => s.functionId === 'FF-S03')).toMatchObject({ kind: 'inactive' });
    expect(t.skipped.find((s) => s.functionId === 'FF-P06')).toMatchObject({ kind: 'untranslatable' });
    // 4 layers, each with a directory and a file-pattern selector: 6 ordered layer pairs x 4 selector pairs.
    expect(t.translated.find((x) => x.functionId === 'FF-S01')?.ruleCount).toBe(24);
    const s01 = t.config.forbidden.find((r) => r.name.startsWith('FF-S01--domain--infrastructure'));
    expect(s01?.to).toMatchObject({ pathNot: expect.arrayContaining(['(^|/)node_modules/']) as unknown });
    expect(t.config.options).toMatchObject({ tsPreCompilationDeps: true, doNotFollow: { path: 'node_modules' } });
  });
  it('layered spec: S03 translated with every non-adjacent or upward pair, S04 inactive', async () => {
    const t = await translateSpec(resolve(ROOT, 'corpus/specs/v-aguiar__valex.yaml'));
    const ids = t.translated.map((x) => x.functionId);
    expect(ids).toContain('FF-S03');
    expect(ids).not.toContain('FF-S04');
    const pairs = new Set(t.config.forbidden.filter((r) => r.name.startsWith('FF-S03')).map((r) => r.name.split('--').slice(1, 3).join('>')));
    // persistence(0) business(1) presentation(2): allowed 1>0 and 2>1 only.
    expect([...pairs].sort()).toEqual(['business>presentation', 'persistence>business', 'persistence>presentation', 'presentation>persistence']);
  });
  it('every untranslated template has a stated reason', () => {
    for (const id of Object.keys(TRANSLATED_FUNCTIONS)) expect(id).toMatch(/^FF-/);
    expect(Object.values(UNTRANSLATABLE).every((r) => r.length > 10)).toBe(true);
  });
});

describe('comparison scoring', () => {
  const f = (functionId: string, filePath: string, target = ''): Finding => ({ functionId, filePath, target });
  it('canonical cycles rotate to the smallest path and drop the closing repeat', () => {
    expect(canonicalCycle(['b', 'c', 'a', 'b'])).toEqual(['a', 'b', 'c']);
    expect(canonicalCycle(['a', 'b'])).toEqual(['a', 'b']);
  });
  it('maps both tools onto one key', () => {
    const da = daFindings({ violations: [
      { functionId: 'FF-S02', route: 'symbolic', filePath: 'b.ts,a.ts,b.ts', discriminator: [JSON.stringify(['b.ts', 'a.ts', 'b.ts'])] },
      { functionId: 'FF-P01', route: 'symbolic', filePath: 'd.ts', target: 'typeorm' },
      { functionId: 'FF-N01', route: 'neuronal', filePath: 'd.ts' },
    ] });
    const dc = depcruiseFindings([
      { type: 'cycle', from: 'a.ts', to: 'b.ts', rule: { name: 'FF-S02--cycle' }, cycle: [{ name: 'b.ts' }, { name: 'a.ts' }] },
      { from: 'd.ts', to: 'node_modules/typeorm/index.js', rule: { name: 'FF-P01--domain--packages--0' } },
    ]);
    expect(da.map(findingKey).sort()).toEqual(dc.map(findingKey).sort());
  });
  it('new findings are a multiset difference; detection needs an expected key', () => {
    const base = [f('FF-S01', 'a.ts', 'b.ts')];
    const seeded = [f('FF-S01', 'a.ts', 'b.ts'), f('FF-S01', 'a.ts', 'b.ts'), f('FF-C04', 'o.ts')];
    const news = newFindings(seeded, base);
    expect(news.map(findingKey)).toEqual([findingKey(f('FF-S01', 'a.ts', 'b.ts')), findingKey(f('FF-C04', 'o.ts'))]);
    expect(detects(news, [{ functionId: 'FF-C04', filePath: 'o.ts', target: '' }])).toBe(true);
    expect(detects(news, [{ functionId: 'FF-S01', filePath: 'a.ts', target: 'c.ts' }])).toBe(false);
    const row: ManifestRow = { seedId: 's', projectId: 'p', operatorId: 'MO-C04n', editedFiles: ['x.ts'], createdFiles: ['o.ts'], expected: { functionIds: [], keys: [] } };
    expect(twinFires(news, row)).toBe(true);
  });
  it('a real pair is detected when a before finding on a touched file is gone after (renames mapped)', () => {
    const touched = [{ status: 'R', from: 'src/domain/s.ts', path: 'src/application/s.ts' }, { status: 'M', path: 'src/x.ts' }];
    const before = [f('FF-S01', 'src/domain/s.ts', 'src/infra/r.ts'), f('FF-S01', 'src/other.ts', 'src/infra/r.ts')];
    const fixed = scorePair(before, [f('FF-S01', 'src/other.ts', 'src/infra/r.ts')], touched);
    expect(fixed).toMatchObject({ beforeOnTouched: 1, afterOnTouched: 0, detects: true, detectsStrict: true });
    const stillThere = scorePair(before, [f('FF-S01', 'src/application/s.ts', 'src/infra/r.ts')], touched);
    expect(stillThere).toMatchObject({ detects: false, detectsStrict: false });
    expect(scorePair([], [], touched)).toMatchObject({ detects: false, detectsStrict: false });
  });
  it('wilson interval', () => {
    const [lo, hi] = wilson(8, 8);
    expect(hi).toBe(1);
    expect(lo).toBeCloseTo(0.676, 3);
  });
});
