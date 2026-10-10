/**
 * ADR-029 (Codex arm) SO5 aggregation: the registered Claude-only tests are unchanged by cells of another vendor; the
 * vendor contrast and the vendor self-preference check are appended after them (analysis plan §6.1), hand-computed.
 */
import type { EvaluationReport } from '../../../../src/shared/types/evaluation.js';
import { CLAUDE_ARM_ADAPTER, VENDOR_DIRECTIONAL_FAMILY, so5Tests, vendorOf, vendorTests } from '../../../../scripts/aggregate.js';
import type { So5Cell } from '../../../../scripts/aggregate.js';
import type { RunRecord } from '../../../../scripts/lib/report-io.js';

function cellOf(i: number, model: string, adapterId: string, task: string, level: string, neuronal: number, deterministic: number): So5Cell {
  const record = { runId: `r${String(i)}`, cell: { requestedModelId: model, adapterId } } as unknown as RunRecord;
  const report = {
    evaluationMode: 'full', scoring: { verdictSource: 'ahsCombined' }, ahsCombined: (neuronal + deterministic) / 2, ahsDeterministic: deterministic,
    ahsNeuronal: neuronal, perDimensionScores: [], functionResults: [], neuralResults: [],
  } as unknown as EvaluationReport;
  return { record, report, valid: true, model, specLevel: level, taskId: task, runIndex: 0, fpat: new Map() };
}

function grid(): So5Cell[] {
  const cells: So5Cell[] = [];
  let i = 0;
  for (const [model, adapter] of [['opus', CLAUDE_ARM_ADAPTER], ['sonnet', CLAUDE_ARM_ADAPTER], ['gpt', 'codex-cli']] as const) {
    for (const task of ['t1', 't2']) {
      for (const level of ['none', 'full-aac']) {
        // Claude-written: d = 0.3; GPT-written: d = 0.1.
        const det = 0.5 + 0.01 * i;
        cells.push(cellOf(i++, model, adapter, task, level, det + (adapter === CLAUDE_ARM_ADAPTER ? 0.3 : 0.1), det));
      }
    }
  }
  return cells;
}

describe('ADR-029 vendor analyses (analysis plan §6.1)', () => {
  it('vendorOf maps adapter ids to vendors', () => {
    expect(vendorOf('claude-code-cli')).toBe('anthropic');
    expect(vendorOf('codex-cli')).toBe('openai');
    expect(vendorOf('x')).toBe('x');
  });

  it('the registered Claude-only rows are what so5Tests gives on the Claude cells alone', () => {
    const cells = grid();
    const claude = cells.filter((c) => c.record.cell?.adapterId === CLAUDE_ARM_ADAPTER);
    const registered = so5Tests(claude, { bootstrap: 2, permutation: 3 }, 199, 'opus');
    expect(registered.some((r) => (r[0] ?? '').includes('gpt'))).toBe(false);
    expect(vendorTests(claude, { bootstrap: 2, permutation: 3 }, 199)).toEqual([]);
  });

  it('vendor rows: one vendor test and descriptive pairs per field, then the vendor self-preference check', () => {
    const rows = vendorTests(grid(), { bootstrap: 2, permutation: 3 }, 999);
    const families = [...new Set(rows.map((r) => r[4]))];
    expect(families).toEqual(['vendor:ahsCombined', 'vendor:ahsDeterministic', VENDOR_DIRECTIONAL_FAMILY]);
    const tests = rows.filter((r) => r[0] === 'vendor');
    expect(tests).toHaveLength(2);
    expect(tests.every((r) => r[9] === 'true' && r[10] === 'false')).toBe(true);
    const pairs = rows.filter((r) => (r[0] ?? '').startsWith('model:'));
    expect(pairs.map((r) => r[0])).toEqual(['model:gpt-opus', 'model:gpt-sonnet', 'model:gpt-opus', 'model:gpt-sonnet']);
    expect(pairs.every((r) => r[10] === 'true')).toBe(true);
    const d = rows.at(-1);
    // mean(d | Claude) − mean(d | GPT) = 0.3 − 0.1 = 0.2; every Claude d exceeds every GPT d → Cliff's δ 1.
    expect(d?.[0]).toBe('directional:anthropic-vs-other-vendor');
    expect(d?.[1]).toBe('0.200000');
    expect(d?.[8]).toBe('1.000000');
    expect(Number(d?.[2])).toBeLessThan(0.05);
  });
});
