/**
 * U5b Step 30: full-mode 3 dp reproduction from replayed cassettes (FR-26; BR-U5b-58; exit criterion 2, full-mode part).
 *
 * `tests/fixtures/u5b/reports/full-mode/correct-reference.json` was produced by the built CLI in full mode on the lane
 * Neo4j, with the Mock judge replayed from U4's committed fixture cassettes (`--llm-provider mock --cassette-mode
 * replay --cassette-dir tests/fixtures/judge-cassettes/correct-reference`, no live call), then scrubbed (D-U5b-7).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rescoreReport } from '../../../../scripts/rescore.js';
import type { RescorableReport } from '../../../../scripts/rescore.js';
import { acceptReport } from '../../../../scripts/lib/report-io.js';
import { ROOT } from './score-fixture.js';

const DIR = 'tests/fixtures/u5b/reports/full-mode';

function load(name: string): unknown {
  return JSON.parse(readFileSync(join(ROOT, DIR, name), 'utf8')) as unknown;
}

describe('full-mode re-scoring reproduction (BR-U5b-58)', () => {
  const report = load('correct-reference.json') as RescorableReport & {
    readonly ahsDeterministic: number; readonly ahsCombined: number; readonly ahsNeuronal: number;
    readonly verdict: string; readonly judge: { readonly provider: string; readonly cassetteMode: string };
    readonly neuralResults: readonly { readonly unitResults: readonly unknown[] }[];
  };

  it('the stored report is a full-mode, replayed Mock-judge report with all three AHS fields', () => {
    expect(report.evaluationMode).toBe('full');
    expect(report.scoring?.verdictSource).toBe('ahsCombined');
    expect(report.judge).toMatchObject({ provider: 'mock', cassetteMode: 'replay' });
    expect(report.neuralResults.length).toBe(2);
    expect(report.neuralResults.every((n) => n.unitResults.length > 0)).toBe(true);
    for (const f of ['ahsDeterministic', 'ahsCombined', 'ahsNeuronal'] as const) expect(typeof report[f]).toBe('number');
    expect(acceptReport(report)).toMatchObject({ accepted: true });
    const record = load('correct-reference.run.json') as { readonly specSha: string; readonly cliCommit: string };
    expect(record.specSha).toMatch(/^[0-9a-f]{64}$/);
    expect(record.cliCommit).toMatch(/^[0-9a-f]{40}$/);
  });

  it('ahsDeterministic, ahsCombined and ahsNeuronal reproduce at 3 dp and the verdict from verdictSource matches', () => {
    const r = rescoreReport(report);
    if (!r.ok) throw new Error(`${r.code}: ${r.detail}`);
    const rep = r.value.reproduction;
    expect(r.value.inputSource).toBe('report');
    expect(rep.reproducesStored).toBe(true);
    expect(rep.verdictSource).toBe('ahsCombined');
    for (const f of ['ahsDeterministic', 'ahsCombined', 'ahsNeuronal'] as const) {
      expect(rep.ahs[f]?.toFixed(3)).toBe(report[f].toFixed(3));
    }
    expect(rep.verdict).toBe(report.verdict);
    // A 0.001 change in any one stored field is a mismatch, never a warning.
    for (const f of ['ahsDeterministic', 'ahsCombined', 'ahsNeuronal'] as const) {
      const bumped = { ...report, [f]: Number((report[f] - 0.001).toFixed(3)) };
      expect(rescoreReport(bumped)).toMatchObject({ ok: false, code: 'RESCORE_MISMATCH' });
    }
  });
});
