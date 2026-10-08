/**
 * Baseline-selection projection (OI-11; BR-U5b-76; BR-U4-SEL-04, SEL-07; Build and Test Step 15).
 * Input: the U4 Mock-cassette full-mode report on correct-reference (`tests/fixtures/u5b/reports/full-mode`).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  main, projectBaselineSelection, selectionText, SEL_PROJ_INVALID, SEL_PROJ_NO_NEURAL, SEL_PROJ_NOT_BASELINE,
  SEL_PROJ_TEMPLATE, SEL_PROJ_UNMAPPED,
} from '../../../../scripts/store-baseline-selection.js';
import { judgeSelectionOf } from '../../../../scripts/prepare-bases.js';
import { ROOT } from './score-fixture.js';

const REPORT_PATH = join(ROOT, 'tests/fixtures/u5b/reports/full-mode/correct-reference.json');
const report = (): Record<string, unknown> => JSON.parse(readFileSync(REPORT_PATH, 'utf8')) as Record<string, unknown>;

interface Row { functionId: string; selection: { source: string; selectedUnitIds: string[] }; unitResults: { unitId: string }[] }
const rows = (r: Record<string, unknown>): Row[] => r.neuralResults as Row[];

function capture(): { out: (t: string) => void; err: (t: string) => void; text: () => string } {
  let s = '';
  return { out: (t) => { s += t; }, err: (t) => { s += t; }, text: () => s };
}

describe('projectBaselineSelection (OI-11)', () => {
  it('projects the correct-reference Mock report into 14 units with their file paths', () => {
    const r = projectBaselineSelection('correct-reference', report());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const fns = r.value.functions;
    expect(fns.map((f) => [f.functionId, f.template])).toEqual([
      ['FF-N01', 'architectural-integrity'],
      ['FF-N02', 'intent-alignment'],
    ]);
    expect(fns.map((f) => f.selectedUnitIds.length)).toEqual([4, 10]);
    expect(fns.reduce((n, f) => n + Object.keys(f.unitFiles).length, 0)).toBe(14);
    const n01 = fns[0];
    expect(n01?.unitFiles['src/application/use-cases']).toContain('src/application/use-cases/CreateTaskUseCase.ts');
    const n02 = fns[1];
    for (const u of n02?.selectedUnitIds ?? []) expect(n02?.unitFiles[u]).toEqual([u]);
  });

  it('feeds prepare-bases: judgeSelectionOf accepts the projection and is uncapped', () => {
    const r = projectBaselineSelection('correct-reference', report());
    if (!r.ok) throw new Error(r.detail);
    const sel = judgeSelectionOf(r.value);
    expect(sel.ok).toBe(true);
    if (sel.ok) expect(sel.value.map((s) => [s.functionId, s.capped, s.selectedFiles.length])).toEqual([['FF-N01', false, 10], ['FF-N02', false, 10]]);
  });

  it('is deterministic: the same report gives byte-identical text', () => {
    const a = projectBaselineSelection('p', report());
    const b = projectBaselineSelection('p', report());
    if (!a.ok || !b.ok) throw new Error('refused');
    expect(selectionText(a.value)).toBe(selectionText(b.value));
    expect(selectionText(a.value).endsWith('}\n')).toBe(true);
  });

  it('refuses a report without neural rows (SEL_PROJ_NO_NEURAL)', () => {
    const r = report();
    delete r.neuralResults;
    expect(projectBaselineSelection('p', r)).toMatchObject({ ok: false, code: SEL_PROJ_NO_NEURAL });
    expect(projectBaselineSelection('p', { ...report(), neuralResults: [] })).toMatchObject({ ok: false, code: SEL_PROJ_NO_NEURAL });
  });

  it('refuses a non-object and a malformed row (SEL_PROJ_INVALID)', () => {
    expect(projectBaselineSelection('p', [])).toMatchObject({ ok: false, code: SEL_PROJ_INVALID });
    expect(projectBaselineSelection('p', { neuralResults: [{ functionId: 'FF-N01' }] })).toMatchObject({ ok: false, code: SEL_PROJ_INVALID });
  });

  it('refuses a variant run: selection.source baseline or a seeded list (SEL_PROJ_NOT_BASELINE, SEL-07)', () => {
    const r = report();
    const first = rows(r)[0];
    if (first) first.selection.source = 'baseline';
    expect(projectBaselineSelection('p', r)).toMatchObject({ ok: false, code: SEL_PROJ_NOT_BASELINE });
    const s = report();
    (s.judge as Record<string, unknown>).seededList = ['src/x.ts'];
    expect(projectBaselineSelection('p', s)).toMatchObject({ ok: false, code: SEL_PROJ_NOT_BASELINE });
  });

  it('refuses a neural function whose name is not a judge template (SEL_PROJ_TEMPLATE)', () => {
    const r = report();
    for (const f of r.functionResults as { functionId: string; name: string }[]) if (f.functionId === 'FF-N02') f.name = 'srp-semantic';
    expect(projectBaselineSelection('p', r)).toMatchObject({ ok: false, code: SEL_PROJ_TEMPLATE });
  });

  it('refuses a selected unit without a unitResults row (SEL_PROJ_UNMAPPED)', () => {
    const r = report();
    const n02 = rows(r).find((x) => x.functionId === 'FF-N02');
    if (n02) n02.unitResults = n02.unitResults.slice(1);
    expect(projectBaselineSelection('p', r)).toMatchObject({ ok: false, code: SEL_PROJ_UNMAPPED });
  });
});

describe('store-baseline-selection CLI', () => {
  it('--self-test refuses its built-in symbolic-only report and exits 1', () => {
    const io = capture();
    expect(main(['--self-test'], io)).toBe(1);
    expect(io.text()).toContain(`self-test: ${SEL_PROJ_NO_NEURAL}`);
  });

  it('writes the projection to --out and exits 0; usage error exits 2', () => {
    const written: Record<string, string> = {};
    const io = { ...capture(), writeFile: (p: string, t: string) => { written[p] = t; } };
    expect(main(['--report', REPORT_PATH, '--project', 'correct-reference', '--out', 'x.json'], io)).toBe(0);
    expect(JSON.parse(written['x.json'] ?? '{}')).toMatchObject({ projectId: 'correct-reference' });
    expect(main(['--report', REPORT_PATH], capture())).toBe(2);
  });
});
