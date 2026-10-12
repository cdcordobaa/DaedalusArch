/**
 * Reproduction audit 2026-10-10 issue 4: producers for two committed files that had none, and the outside-input record.
 * The real committed inputs are used; each producer must rebuild its file byte for byte.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkExternal, EXTERNAL_INPUT_RECORDS, guardManifest, readExternalRecords, v1SensitivityCsv, withoutTscPath } from '../../../scripts/provenance.js';
import type { ExternalRecord } from '../../../scripts/provenance.js';

const ROOT = join(__dirname, '..', '..', '..');
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

describe('provenance producers (audit 2026-10-10 issue 4)', () => {
  it('guard-case rebuilds results/so4-heldout/case-corrected/manifest.json from case/manifest.json (the two valex MO-S01 rows)', async () => {
    const r = await guardManifest(ROOT, JSON.parse(read('results/so4-heldout/case/manifest.json')) as never);
    expect(r.changed).toEqual(['v-aguiar__valex:MO-S01:0', 'v-aguiar__valex:MO-S01:1']);
    expect(`${JSON.stringify(r.manifest, null, 2)}\n`).toBe(read('results/so4-heldout/case-corrected/manifest.json'));
  });

  it('v1-sensitivity rebuilds results/e7-corpus/v1/ahs_v1_sensitivity.csv from the v1sym and e7-corpus runs', () => {
    expect(v1SensitivityCsv(join(ROOT, 'results/e7-corpus-v1sym'), join(ROOT, 'results/e7-corpus'))).toBe(read('results/e7-corpus/v1/ahs_v1_sensitivity.csv'));
  });

  it('withoutTscPath drops only tscPath; the committed record checks clean against the committed copies', () => {
    expect(withoutTscPath({ a: 1, typecheck: { tscPath: '/x/tsc', tscVersion: '5' } })).toBe(withoutTscPath({ a: 1, typecheck: { tscPath: 'tsc', tscVersion: '5' } }));
    expect(withoutTscPath({ a: 1 })).not.toBe(withoutTscPath({ a: 2 }));
    expect(EXTERNAL_INPUT_RECORDS).toEqual(['results/so4-heldout/external-inputs.json', 'results/sensitivity/external-inputs.json']);
    const committed: ExternalRecord[] = readExternalRecords(ROOT);
    expect(committed.map((c) => c.path)).toEqual(['../daedalus-so4/manifest.json', '../daedalus-so4/prepared-bases-7.json', '../daedalus-sp-probes/manifest.json']);
    expect(checkExternal(ROOT, committed)).toEqual([]);
    const tampered = committed.map((c) => ({ ...c, copies: c.copies.map((x) => ({ ...x, sha256: '0' })) }));
    expect(checkExternal(ROOT, tampered).length).toBeGreaterThan(0);
  });
});
