import { scoreFilterExplain } from '../../../../scripts/v1.3/filter-explain-run.js';
import type { FilterExplainPlan, FilterExplainRow } from '../../../../scripts/v1.3/filter-explain-run.js';
import type { FilterExplainAnswer, ShownFile, SymbolicFinding } from '../../../../src/llm-critic/filter-explain.js';

const small: ShownFile = { path: 'src/domain/a.ts', content: 'export class A {\n  x = 1;\n}\n' };
const answer = (a: Partial<FilterExplainAnswer> = {}): { valid: boolean; response: string } => ({
  valid: true,
  response: JSON.stringify({ decision: 'confirm', explanation: 'See src/domain/a.ts:2.', fix: 'Fix it.', citations: [{ filePath: 'src/domain/a.ts', startLine: 1, endLine: 2 }], ...a }),
});

function row(rowId: string, label: FilterExplainRow['label'], tier: string, finding: Partial<SymbolicFinding>, promptSha: string): FilterExplainRow {
  return {
    rowId, style: 'clean-architecture', variant: 'v01', label, tier, promptSha, files: ['src/domain/a.ts'],
    finding: { functionId: 'FF-S01', type: 'T', severity: 'critical', filePath: 'src/domain/a.ts', message: 'm', ...finding },
  };
}

function planOf(rows: FilterExplainRow[], files: ShownFile[] = [small]): FilterExplainPlan {
  const prompts: Record<string, { prompt: string; files: ShownFile[] }> = {};
  for (const r of rows) prompts[r.promptSha] = { prompt: `prompt ${r.promptSha}`, files };
  return { feRevision: 'fe-1.0', feSha256: 'x', rows, prompts, selected: [...new Set(rows.map((r) => r.promptSha))].sort(), skipped: [] };
}

const rows = [
  row('clean/v08#2', 'true', 'blocking', { functionId: 'FF-P06', discriminator: ['A', 'Repo', 'FLOWS_TO', 'repo'] }, 'p1'),
  row('clean/v09#0', 'true', 'blocking', { functionId: 'FF-P06', discriminator: ['A', 'Repo', 'CONSTRUCTOR_INJECTS', 'repo'] }, 'p2'),
  row('clean/v10#0', 'true', 'blocking', { functionId: 'FF-S01' }, 'p3'),
  row('nestjs/n03#0', 'false', 'advisory', { functionId: 'FF-P02' }, 'p4'),
  row('hex/v10#2', 'true', 'blocking', { functionId: 'FF-P06', message: 'A holds Repo via HOLDS_STATE_OF field repo' }, 'p5'),
];
const answers = { p1: answer(), p2: answer(), p3: answer(), p4: answer({ decision: 'dismiss' }), p5: answer() };

describe('filter-explain-run score', () => {
  it('R26: by default (committed judge-v2 scoring) FF-P06 FLOWS_TO / HOLDS_STATE_OF rows stay blocking TPs', () => {
    const s = scoreFilterExplain(planOf(rows), answers);
    expect(s.summary).toMatchObject({ tp0: 4, fp0: 1, tp1: 4, fp1: 0 });
    expect(s.rows.filter((r) => r.label === 'n/a')).toHaveLength(0);
  });

  it("R26: with naPartial the FF-P06 N/A half (FLOWS_TO, HOLDS_STATE_OF) is labelled 'n/a' and left out of the counts", () => {
    const s = scoreFilterExplain(planOf(rows), answers, { naPartial: true });
    expect(s.rows.filter((r) => r.label === 'n/a').map((r) => r.rowId).sort()).toEqual(['clean/v08#2', 'hex/v10#2']);
    expect(s.summary).toMatchObject({ tp0: 2, fp0: 1, tp1: 2, fp1: 0, na: 2 });
    expect(s.md).toContain('| n/a | 2 |');
  });

  it('R19: score grounds each answer against the lines the prompt rendered, not the full files', () => {
    const big: ShownFile = { path: 'src/domain/a.ts', content: Array.from({ length: 3000 }, (_, i) => `export const value${String(i)} = 'xxxxxxxxxxxxxxxxxxxx';`).join('\n') };
    const r = [row('clean/v10#0', 'true', 'blocking', { functionId: 'FF-S01' }, 'p3')];
    const late = { p3: answer({ explanation: 'See the code.', citations: [{ filePath: 'src/domain/a.ts', startLine: 2900, endLine: 2900 }] }) };
    const early = { p3: answer({ explanation: 'See the code.', citations: [{ filePath: 'src/domain/a.ts', startLine: 20, endLine: 20 }] }) };
    expect(scoreFilterExplain(planOf(r, [big]), late).rows[0]?.status).toBe('rejected');
    expect(scoreFilterExplain(planOf(r, [big]), early).rows[0]?.status).toBe('confirm');
  });

  it('score passes bareLines through (default: longest, D-e; attributed R20 and finding-file opt-in)', () => {
    const longer: ShownFile = { path: 'src/infra/b.ts', content: Array.from({ length: 50 }, () => '//').join('\n') };
    const r = [row('clean/v10#0', 'true', 'blocking', { functionId: 'FF-S01' }, 'p3')];
    const a = { p3: answer({ explanation: 'At line 30.' }) };
    expect(scoreFilterExplain(planOf(r, [small, longer]), a).rows[0]?.status).toBe('confirm');
    expect(scoreFilterExplain(planOf(r, [small, longer]), a, { bareLines: 'attributed' }).rows[0]?.status).toBe('rejected');
    expect(scoreFilterExplain(planOf(r, [small, longer]), a, { bareLines: 'longest' }).rows[0]?.status).toBe('confirm');
    expect(scoreFilterExplain(planOf(r, [small, longer]), a, { bareLines: 'finding-file' }).rows[0]?.status).toBe('rejected');
  });
});
