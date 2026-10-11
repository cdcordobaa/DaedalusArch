/**
 * ADR-038 judge model robustness: the pure parts (draw, order, request rebuild, substitution re-score).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { callOrder, drawSample, judgeRequestFor, scoreWithRows, substitute } from '../../../scripts/judge-robustness.js';
import type { SampledUnit } from '../../../scripts/judge-robustness.js';
import { requestHashOf } from '../../../src/llm-critic/cassette-provider.js';
import type { UnitVote } from '../../../src/llm-critic/aggregation.js';

const unit = (source: 'E7' | 'E1', functionId: string, i: number): SampledUnit => ({
  source, functionId, runId: `r${String(i).padStart(3, '0')}`, projectId: 'p', unitId: `u${String(i)}`, reportPath: 'x',
  opusRequestHash: 'h', opusVote: 'pass', opusConfidence: 0.9, sonnetRequestHash: 's',
});

describe('judge-robustness sample', () => {
  const frame = [...Array.from({ length: 40 }, (_, i) => unit('E7', 'FF-N01', i)), ...Array.from({ length: 10 }, (_, i) => unit('E1', 'FF-N02', i))];

  it('draws per stratum deterministically, all units of a small stratum', () => {
    const a = drawSample(frame, 9401, 25);
    expect(a).toEqual(drawSample(frame, 9401, 25));
    expect(a.strata.find((s) => s.source === 'E7' && s.functionId === 'FF-N01')).toMatchObject({ eligible: 40, drawn: 25 });
    expect(a.strata.find((s) => s.source === 'E1' && s.functionId === 'FF-N02')).toMatchObject({ eligible: 10, drawn: 10 });
    expect(a.units).toHaveLength(35);
  });

  it('interleaves strata round-robin', () => {
    const order = callOrder({ units: [unit('E7', 'FF-N01', 1), unit('E7', 'FF-N01', 2), unit('E1', 'FF-N02', 3)] });
    expect(order.map((u) => u.unitId)).toEqual(['u1', 'u3', 'u2']);
  });

  it('the rebuilt request differs only in the model', () => {
    const a = judgeRequestFor('prompt', 'claude-opus-5-5', ['--x']);
    const b = judgeRequestFor('prompt', 'claude-sonnet-5-5', ['--x']);
    expect({ ...a, model: '' }).toEqual({ ...b, model: '' });
    expect(requestHashOf(a)).not.toBe(requestHashOf(b));
  });
});

describe('judge-robustness substitution', () => {
  const dir = path.resolve(__dirname, '../../../results/e7-corpus/reports');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  const read = (f: string): Record<string, unknown> => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Record<string, unknown>;

  (files.length > 0 ? it : it.skip)('an identity swap reproduces the stored re-score', () => {
    const report = read(files[0] ?? '');
    const rows = (report.neuralResults as { functionId: string; unitResults: (UnitVote & { unitId: string })[] }[]);
    const swaps = new Map(rows.flatMap((n) => n.unitResults.map((u) => [`${n.functionId}\u0000${u.unitId}`, u as UnitVote] as const)));
    const same = scoreWithRows(report, substitute(report, swaps), 'majority');
    expect(same.ahs.toFixed(3)).toBe(Number(report.ahsCombined).toFixed(3));
    expect(same.verdict).toBe(report.verdict);
  });

  (files.length > 0 ? it : it.skip)('failing every unit of a function lowers the combined AHS', () => {
    const report = read(files[0] ?? '');
    const rows = (report.neuralResults as { functionId: string; unitResults: (UnitVote & { unitId: string })[] }[]);
    const swaps = new Map(rows.flatMap((n) => n.unitResults.map((u) => [`${n.functionId}\u0000${u.unitId}`, { ...u, status: 'valid', verdict: 'fail', confidence: 0.95 }] as const)));
    expect(scoreWithRows(report, substitute(report, swaps), 'majority').ahs).toBeLessThan(Number(report.ahsCombined));
  });
});
