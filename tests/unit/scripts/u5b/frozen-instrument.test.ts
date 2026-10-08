/**
 * U5b Step 13: frozen-instrument exporter (ADR-015 item 2; BR-U5b-52; BR-U1-02, 16; BR-U3-70 item 4; OI-U5b-P2-3).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CYPHER_TEMPLATES } from '../../../../src/fitness-compiler/cypher-templates.js';
import { computeFrozenSha256, FROZEN_SHA256, FROZEN_VALUES } from '../../../../src/llm-critic/frozen.js';
import {
  allTemplateIds, exportFrozenInstrument, FROZEN_EXPORT_FINAL_REFUSED, main,
} from '../../../../scripts/export-frozen-instrument.js';
import type { FrozenInstrument } from '../../../../scripts/export-frozen-instrument.js';
import { ROOT } from './score-fixture.js';

function run(argv: string[], judge?: unknown): { code: number; out: string; err: string; files: Map<string, string> } {
  let out = '';
  let err = '';
  const files = new Map<string, string>();
  const code = main(argv, ROOT, { out: (t) => { out += t; }, err: (t) => { err += t; }, writeFile: (f, t) => { files.set(f, t); } }, judge);
  return { code, out, err, files };
}

function exported(): FrozenInstrument {
  const e = exportFrozenInstrument(ROOT);
  if (!e.ok) throw new Error(e.detail);
  return e.value;
}

describe('frozen-instrument exporter (BR-U5b-52)', () => {
  it('two exports are byte-identical', () => {
    const a = run([]);
    const b = run([]);
    expect(a.code).toBe(0);
    expect(a.out.length).toBeGreaterThan(0);
    expect(Buffer.from(a.out).equals(Buffer.from(b.out))).toBe(true);
    const c = run(['--out', 'tmp/fi.json']);
    expect([...c.files.values()]).toEqual([a.out]);
  });

  it('maxCycleLength equals the compiler constant 10; pattern grammar and row cap from code', () => {
    const fi = exported();
    expect(fi.maxCycleLength).toBe(10);
    expect(fi.cycleRowCap).toBe(100);
    expect(fi.patternGrammar).toBe('^[A-Za-z0-9_$*?]+(\\|[A-Za-z0-9_$*?]+)*$');
  });

  it('--final without the U4 judge freeze exits 1 and writes nothing; with it, exits 0', () => {
    const r = run(['--final', '--out', 'x.json'], null);
    expect(r.code).toBe(1);
    expect(r.err).toContain(FROZEN_EXPORT_FINAL_REFUSED);
    expect(r.files.size).toBe(0);
    expect(run(['--final'], { unitCap: 1 }).code).toBe(0);
    // Default: U4's FROZEN_VALUES verbatim with the hash anchor (merged at Step 26); a final export succeeds.
    expect(exported().judgeFreeze).toEqual(JSON.parse(JSON.stringify({ frozenSha256: FROZEN_SHA256, values: FROZEN_VALUES })));
    expect(computeFrozenSha256()).toBe(FROZEN_SHA256);
    expect(run(['--final']).code).toBe(0);
    expect(run(['--self-test']).code).toBe(1);
    expect(run(['--bogus']).code).toBe(2);
  });

  it('tags cover every compiled template and equal the tags the CLI writes into reports (OI-U5b-P2-3)', () => {
    const fi = exported();
    expect(Object.keys(fi.tags).sort()).toEqual([...CYPHER_TEMPLATES.keys()].sort());
    expect(allTemplateIds()).toEqual([...CYPHER_TEMPLATES.keys()].sort());
    const dirs = ['tests/fixtures/u5b/reports', 'tests/fixtures/u5b/hand-computed/reports'];
    let compared = 0;
    for (const dir of dirs) {
      for (const f of readdirSync(join(ROOT, dir)).filter((n) => n.endsWith('.json') && !n.endsWith('.run.json'))) {
        const report = JSON.parse(readFileSync(join(ROOT, dir, f), 'utf8')) as { functionResults: { name: string; tag?: string }[] };
        for (const row of report.functionResults) {
          if (row.tag === undefined) continue;
          expect({ name: row.name, tag: fi.tags[row.name] }).toEqual({ name: row.name, tag: row.tag });
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(100);
  });

  it('applicability: every template × four style columns; layered and no-layer-skip as frozen by U1', () => {
    const fi = exported();
    expect(fi.applicability).toHaveLength(CYPHER_TEMPLATES.size * 4);
    const cell = (t: string, s: string): unknown => fi.applicability.find((r) => r.template === t && r.style === s);
    expect(cell('no-layer-skip', 'layered')).toEqual({ template: 'no-layer-skip', style: 'layered', applicable: true });
    expect(cell('no-layer-skip', 'clean-architecture')).toEqual({ template: 'no-layer-skip', style: 'clean-architecture', applicable: false, reason: 'not applicable to style clean-architecture' });
    expect(cell('naming-services', 'layered')).toEqual({ template: 'naming-services', style: 'layered', applicable: false, reason: 'no application layer' });
    expect(cell('dependency-inversion', 'none')).toEqual({ template: 'dependency-inversion', style: 'none', applicable: true });
  });

  it('self-spec deviations (BR-U1-16), U3 scoring freeze and metric-key readiness', () => {
    const fi = exported();
    expect(fi.selfSpecDeviations).toEqual(expect.arrayContaining([
      'layer core-modules kind: infrastructure', 'FF-C03 threshold: 0.8', 'FF-C02 threshold: 15', 'FF-C05 threshold: 20',
      'FF-C06 threshold: 0.25', 'FF-SO01 max_public_methods: 12', 'FF-SO01 max_dependencies: 7', 'FF-SO02 max_interface_methods: 7',
    ]));
    expect(fi.selfSpecDeviations.filter((d) => d.includes('exclude_paths'))).toHaveLength(4);
    expect(fi.scoringFreeze).toEqual({
      verdictSource: { 'symbolic-only': 'ahsDeterministic', 'neuronal-only': 'ahsNeuronal', full: 'ahsCombined' },
      ahsNeuronal: { weights: 'fullModeWeights', dimensions: ['semantic', 'integrity'], renormalised: true },
    });
    // Step 2 readiness flags (both true).
    expect(fi.metricKeyReadiness).toEqual({ projectLevelKeys: true, rowFilters: true });
  });
});
