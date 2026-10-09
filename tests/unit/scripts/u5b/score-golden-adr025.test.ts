/**
 * ADR-025 (POST-HOC, matching rule 1.2.0, MAT-04a): a `class-rename` seed maps the baseline identities of the renamed
 * class onto its new name before the multiset difference, so pre-existing violations re-keyed by the rename are not
 * new. The case is the real SO4 seed `truthy-demo:MO-CV02:0` (results/so4-heldout, strict score: FP 2 on
 * `src/email-template/email-template.service.ts`, FF-P02 and FF-P04 re-keyed `EmailTemplateService` →
 * `EmailTemplateServiceImpl`), reduced to the violations of the site file.
 */
import type { ManifestRow } from '../../../../scripts/lib/manifest.js';
import { classRenameOf, remapRenamedIdentity, scoreDifferential } from '../../../../scripts/score-golden.js';
import type { GoldenScore, ScoreOutcome } from '../../../../scripts/score-golden.js';
import { FNS, HELD_OUT, key, report, row, rule, seed } from './score-fixture.js';
import type { Fn, V } from './score-fixture.js';

const F = 'src/email-template/email-template.service.ts';
const OLD = 'EmailTemplateService';
const NEW = 'EmailTemplateServiceImpl';
const EXTRA: readonly Fn[] = [
  { functionId: 'FF-P02', name: 'dependency-inversion', dimension: 'pattern', tag: 'pattern-proxy' },
  { functionId: 'FF-P04', name: 'use-case-isolation', dimension: 'pattern', tag: 'pattern-proxy' },
  { functionId: 'FF-CV02', name: 'naming-services', dimension: 'convention', tag: 'pattern-proxy' },
];
const fns = [...FNS, ...EXTRA];

// Baseline and seeded violations of the site file as recorded in so4-heldout-002 and so4-heldout-052.
const BASE: V[] = [
  { functionId: 'FF-P02', filePath: F, discriminator: [OLD] },
  { functionId: 'FF-P04', filePath: F, discriminator: [OLD] },
  { functionId: 'FF-CV05', filePath: F, discriminator: [] },
];
const SEEDED: V[] = [
  { functionId: 'FF-P02', filePath: F, discriminator: [NEW] },
  { functionId: 'FF-P04', filePath: F, discriminator: [NEW] },
  { functionId: 'FF-CV02', filePath: F, discriminator: [NEW] },
  { functionId: 'FF-CV05', filePath: F, discriminator: [] },
];

function renameRow(operatorId: 'MO-CV02' | 'MO-CV02n', expected: Record<string, unknown>): ManifestRow {
  const r = row({ seedId: `truthy-demo:${operatorId}:0`, operatorId, expected });
  return { ...r, site: { filePath: F, line: 16, kind: 'class-rename', detail: { class: OLD } } };
}

function ok(o: ScoreOutcome): GoldenScore {
  if (!o.ok) throw new Error(`${o.code}: ${o.detail}`);
  return o.score;
}

describe('MAT-04a 1.2.0: class-rename identity (ADR-025)', () => {
  it('truthy-demo:MO-CV02:0 — FF-P02 / FF-P04 re-keyed by the rename are pre-existing; FF-CV02 is the TP; FP 0 (strict SO4: FP 2)', async () => {
    const b = await report(BASE, { fns });
    const s = await report(SEEDED, { fns });
    const r = renameRow('MO-CV02', { functionIds: ['FF-CV02'], dimension: 'convention', keys: [key('FF-CV02', F, '', [NEW], 'site-line', 16)] });
    expect(classRenameOf(r, b as never, s as never)).toEqual({ filePath: F, from: OLD, to: NEW });
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(r, b, s)] }));
    expect(score.overall.get(HELD_OUT)?.strict).toMatchObject({ tp: 1, fp: 0, fn: 0 });
    expect(score.preExistingIgnored).toBe(3);
    expect(score.perInstance[0]?.undeclaredNew ?? []).toEqual([]);
  });

  it('twin (MO-CV02n, conforming new name) is twin-clean when only re-keyed pre-existing violations differ', async () => {
    const twinNew = `Core${OLD}`;
    const b = await report(BASE, { fns });
    const s = await report(SEEDED.filter((v) => v.functionId !== 'FF-CV02').map((v) => (v.discriminator?.[0] === NEW ? { ...v, discriminator: [twinNew] } : v)), { fns });
    const r = renameRow('MO-CV02n', { negative: true, twinOf: 'MO-CV02', functionIds: [], keys: [] });
    expect(classRenameOf(r, b as never, s as never)?.to).toBe(twinNew);
    const score = ok(scoreDifferential({ rule: rule(), seeds: [seed(r, b, s)] }));
    expect(score.perInstance[0]?.status).toBe('twin-clean');
  });

  it('no remap outside the site file, for a non-rename row, or when the new name is not in the frozen rename list', async () => {
    const other = { functionId: 'FF-P02', filePath: 'src/other.ts', discriminator: [OLD] };
    const rename = { filePath: F, from: OLD, to: NEW };
    expect(remapRenamedIdentity(other as never, rename).discriminator).toEqual([OLD]);
    expect(remapRenamedIdentity({ ...other, filePath: F } as never, rename).discriminator).toEqual([NEW]);
    const b = await report(BASE, { fns });
    const s = await report(SEEDED.map((v) => (v.discriminator?.[0] === NEW ? { ...v, discriminator: ['Unlisted'] } : v)), { fns });
    expect(classRenameOf(renameRow('MO-CV02', {}), b as never, s as never)).toBeUndefined();
    const plain = row({ expected: {} });
    expect(classRenameOf({ ...plain, site: { filePath: F, line: 1, kind: 'import-edge', detail: {} } }, b as never, s as never)).toBeUndefined();
  });
});
