/**
 * U6 Labels: the label-plan producer end to end (ADR-021 SO3-2, SO4-02, SO3-3, SO4-01, SO5-01; item 6).
 *
 * From stored outputs only: a scored case (P1 items and missed seeds), corpus, E1 and fixture run directories. The plan
 * is labelled by a scripted Mock labeller in record mode (a temp cassette directory), and the labels are read back
 * by score-golden (`--labels`) and by aggregate's FPAT input. Fixture-derived expectations are counted from the
 * committed fixture reports by hand (see the comments).
 */
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DomainResult } from '../../../../src/shared/errors/domain-result.js';
import type { LLMCallContext, LLMOptions, LLMProvider, LLMResponse } from '../../../../src/shared/interfaces/llm-provider.js';
import type { ProviderDescription } from '../../../../src/shared/types/evaluation.js';
import {
  LABEL_PLAN_INPUT_INVALID, P2_ROW_V1, P2_ROW_V1_ONLY, P2_ROW_V2, buildLabelPlan, main as buildMain, seededCopyRoot,
} from '../../../../scripts/build-label-plan.js';
import type { PlanSummary, So4Inputs } from '../../../../scripts/build-label-plan.js';
import { p2PrecisionRows } from '../../../../scripts/build-label-plan.js';
import { LABEL_BUDGET_STOP, labelItems, loadLabellerPrompts } from '../../../../scripts/llm-label.js';
import type { LabelPlanFile, LabellerPrompt, ReconciledLabel } from '../../../../scripts/llm-label.js';
import type { ItemKind, LabelItem } from '../../../../scripts/lib/label-context.js';
import type { LabelPlanConfig } from '../../../../scripts/lib/label-plan.js';
import { fnCauseColumns } from '../../../../scripts/lib/label-adapters.js';
import type { JudgeUnitVerdict } from '../../../../scripts/lib/judge-verdicts.js';
import { loadManifest } from '../../../../scripts/lib/manifest.js';
import type { ManifestRow } from '../../../../scripts/lib/manifest.js';
import { loadMatchingRule } from '../../../../scripts/lib/matching-rule.js';
import { loadRunDir } from '../../../../scripts/lib/report-io.js';
import { loadSo5Codes } from '../../../../scripts/lib/so5-codes.js';
import { fpatCounts, fpatLabelsFromFile } from '../../../../scripts/aggregate.js';
import { SCORE_LABELS_MISSING, main as scoreMain } from '../../../../scripts/score-golden.js';
import type { LabelItemsFile } from '../../../../scripts/score-golden.js';
import { presentedList } from '../u5b/label-fixture.js';
import { ROOT } from '../u5b/score-fixture.js';

const SPEC = 'specs/clean-arch.yaml';
const SPEC_SHA = createHash('sha256').update(readFileSync(join(ROOT, SPEC))).digest('hex');
const MODEL = 'gemini-3.1-pro-high';

/** A test configuration that still labels P3 (the FPAT labelled path); the registered config has P3 at 0 (item 8.1). */
const CONFIG: LabelPlanConfig = {
  version: 3, provider: 'mock', model: MODEL, budgetCalls: 300, reaskReserveCalls: 30, seeds: { strata: 6101, permutation: 6103, bootstrap: 6102, audit: 6105 },
  priority: ['P4', 'P2', 'P3'], sampled: { P4: { perStratum: 1, maxItems: 46 }, P2: { perStratum: 1, maxItems: 20, v1OnlyMaxItems: 0 }, P3: { perStratum: 1, maxItems: 10 } },
  exhaustivePlanned: 59, exhaustivePlannedBasis: 'test', context: { maxChars: { violation: 6000, 'missed-seed': 6000, 'judge-unit': 32000 } },
  quota: { callsPerWeek: 180, minWeeks: 2, maxWeeks: 4 },
};

/** Answers by option name: violations TP, judge units pass, missed seeds FN with RC-LAYER-MAP (so both runs agree). */
class AgreeingLabeller implements LLMProvider {
  readonly name = 'agreeing-mock';
  describe(): ProviderDescription {
    return { provider: 'mock', model: 'mock-model' };
  }
  evaluate(prompt: string, _o: LLMOptions, _c?: LLMCallContext): Promise<DomainResult<LLMResponse>> {
    const opts = presentedList(prompt, 'Label options');
    const rcs = presentedList(prompt, 'Root causes');
    const o = (l: string): number => opts.indexOf(l) + 1;
    const answer = opts.includes('pass') ? { option: o('pass'), rootCause: null, rationale: 'reads fine' }
      : opts.includes('FN') ? { option: o('FN'), rootCause: rcs.indexOf('RC-LAYER-MAP') + 1, rationale: 'outside the globs' }
        : { option: o('TP'), rootCause: null, rationale: 'crosses the boundary' };
    const content = JSON.stringify(answer);
    return Promise.resolve(DomainResult.ok({ content, model: 'mock-model', usage: { inputTokens: 1, outputTokens: 1 }, usedOptions: {}, ignoredOptions: [] }));
  }
}

function prompts(): ReadonlyMap<ItemKind, LabellerPrompt> {
  const p = loadLabellerPrompts(ROOT);
  if (!p.ok) throw new Error(p.detail);
  return p.prompts;
}

async function label(plan: LabelPlanFile, cassetteDir: string, budgetCalls = plan.budgetCalls): Promise<ReconciledLabel[]> {
  const r = await labelItems(plan.items, {
    provider: new AgreeingLabeller(), model: MODEL, runs: 2, mode: 'record', cassetteDir, permutationSeed: plan.permutationSeed, budgetCalls,
    knownSecrets: [], now: () => '2026-10-09T00:00:00.000Z',
  }, prompts());
  if (!r.ok) throw new Error(`${r.code}: ${r.detail}`);
  return [...r.labels];
}

function io(): { out: string[]; err: string[]; files: Map<string, string>; io: { out: (t: string) => void; err: (t: string) => void; writeFile: (f: string, t: string) => void } } {
  const out: string[] = [];
  const err: string[] = [];
  const files = new Map<string, string>();
  return {
    out, err, files,
    io: { out: (t) => { out.push(t); }, err: (t) => { err.push(t); }, writeFile: (f, t) => { files.set(f, t); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, t); } },
  };
}

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'u6-labels-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

/** A run directory with one record and its report (`projectPath` as in the fixture, resolved against the repo root). */
function runDir(name: string, record: Record<string, unknown>, reportFile: string): string {
  const dir = join(tmp, name);
  mkdirSync(join(dir, 'runs'), { recursive: true });
  mkdirSync(join(dir, 'reports'), { recursive: true });
  cpSync(join(ROOT, reportFile), join(dir, 'reports', `${String(record.runId)}.json`));
  writeFileSync(join(dir, 'runs', `${String(record.runId)}.run.json`), JSON.stringify({
    attempt: 1, status: 'accepted', specSha: SPEC_SHA, cliCommit: 'c'.repeat(40), preregVersion: 2, frozenHashes: {}, envRecordId: 'test',
    startedAt: '2026-10-09T00:00:00.000Z', wallMs: 1, reportPath: `reports/${String(record.runId)}.json`, ...record,
  }));
  return dir;
}

const E1_CELL = {
  requestedModelId: 'claude-haiku-4-5', adapterId: 'a', promptTemplateId: 'p', style: 'clean-architecture', specLevel: 'none', taskId: 'task-management',
  runIndex: 0, generationOutcomePath: 'g.json', generationStatus: 'ok', fileCount: 20, fileCountInRange: true, permissionDenials: 0,
};

describe('build-label-plan from run directories (P2, P3, P4, judge verdicts)', () => {
  it('writes the plan, the verdicts and the summary; sizes and inclusion probabilities follow the registered config', async () => {
    const corpus = runDir('corpus', { runId: 'e7-corpus-000-variant-a-structural', planId: 'e7-corpus', projectId: 'variant-a-structural' }, 'tests/fixtures/u5b/reports/variant-a-structural.json');
    const e1 = runDir('e1', { runId: 'e1-grid-000-cell-a', planId: 'e1-grid', projectId: 'cell-a', cell: E1_CELL }, 'tests/fixtures/u5b/reports/full-mode/correct-reference.json');
    const fixtures = runDir('fixtures', { runId: 'fixtures-000-correct-reference', planId: 'fixtures', projectId: 'correct-reference' }, 'tests/fixtures/u5b/reports/full-mode/correct-reference.json');
    writeFileSync(join(tmp, 'config.json'), JSON.stringify(CONFIG));
    const out = join(tmp, 'out');
    const a = io();
    const code = await buildMain(['--out', out, '--config', join(tmp, 'config.json'), '--corpus-runs', corpus, '--e1-runs', e1, '--fixture-runs', fixtures, '--specs', SPEC], ROOT, a.io);
    expect(a.err.join('')).toBe('');
    expect(code).toBe(0);
    const plan = JSON.parse(readFileSync(join(out, 'label-plan.json'), 'utf8')) as LabelPlanFile;
    const count = (p: string): number => plan.items.filter((i) => i.population === p).length;
    // variant-a-structural has violations of 9 functions -> 9 P2 strata, 1 item each (9 <= 20, all strata kept).
    expect(count('P2')).toBe(9);
    // correct-reference (full mode) has symbolic violations of FF-C03 and FF-CV05 -> 2 P3 strata of cell-a.
    expect(count('P3')).toBe(2);
    // P4: (cell-a | correct-reference) x (integrity: 4 units, semantic: 10 units) -> 4 strata, p = 1/4 and 1/10.
    expect(count('P4')).toBe(4);
    expect(plan.items.filter((i) => i.population === 'P4').map((i) => i.inclusionProbability).sort()).toEqual([0.1, 0.1, 0.25, 0.25]);
    expect(plan).toMatchObject({ sizing: 'registered', provider: 'mock', model: MODEL, permutationSeed: 6103, bootstrapSeed: 6102, auditSeed: 6105, budgetCalls: 300, reaskReserveCalls: 30 });
    // Every P2..P4 item names its run (FPAT rows key on it).
    expect(new Set(plan.items.map((i) => i.runId))).toEqual(new Set(['e7-corpus-000-variant-a-structural', 'e1-grid-000-cell-a', 'fixtures-000-correct-reference']));
    // Contexts: source window or unit source, never the judge verdict or rationale (BR-U5b-35).
    for (const i of plan.items) {
      expect(i.context.length).toBeLessThanOrEqual(i.kind === 'judge-unit' ? 32000 : 6000);
      expect(i.context).not.toMatch(/rationale|confidence/i);
    }
    // Judge verdicts: every valid pass/fail unit of both P4 runs (14 + 14), with source and generator model.
    const verdicts = JSON.parse(readFileSync(join(out, 'judge-verdicts.json'), 'utf8')) as JudgeUnitVerdict[];
    expect(verdicts).toHaveLength(28);
    expect(new Set(verdicts.map((v) => `${v.source ?? ''}|${v.generatorModel ?? ''}`))).toEqual(new Set(['e1|claude-haiku-4-5', 'fixture|']));
    expect(a.out.join('')).toContain('items: P1 0, MS 0, P4 4, P2 9, P3 2');
    expect(a.out.join('')).toContain('calls: 30 + re-ask reserve 30 <= budget 300; at least 2 week(s)');

    // Label it, then feed aggregate's FPAT input (SO5-01): the symbolic family counts are no longer zero.
    const labels = await label(plan, join(tmp, 'cassettes'));
    const { records, reports } = loadRunDir(e1);
    const fpat = fpatLabelsFromFile(labels, records);
    expect(fpat).toHaveLength(2);
    expect(fpat.every((l) => l.runId === 'e1-grid-000-cell-a' && l.label === 'TP')).toBe(true);
    const so5 = loadSo5Codes(ROOT);
    if (!so5.ok) throw new Error(so5.detail);
    const counts = fpatCounts('e1-grid-000-cell-a', reports.get('e1-grid-000-cell-a'), fpat, so5.codes);
    const symbolic = [...counts].filter(([fam]) => fam !== 'FPAT-SEMANTIC' && fam !== 'FPAT-INTEGRITY');
    expect(symbolic.length).toBeGreaterThan(0);
    // Weighted: each P3 item weighs 1 / p, p = 1 / N_h; the weighted total equals the two strata sizes.
    const sizes = plan.strata.filter((s) => s.population === 'P3').reduce((n, s) => n + s.size, 0);
    expect(symbolic.reduce((n, [, c]) => n + c.weighted, 0)).toBeCloseTo(sizes, 9);

    // The budget is a hard stop: a third of the calls is refused (LABEL_BUDGET_STOP).
    await expect(label(plan, join(tmp, 'cassettes-2'), 10)).rejects.toThrow(LABEL_BUDGET_STOP);
  });

  it('ADR-021 item 8 with the registered config: P3 out of labelling (strata kept), P2 calls, audit seed, precision rows, cut by kind', async () => {
    const corpus = runDir('corpus', { runId: 'e7-corpus-000-variant-a-structural', planId: 'e7-corpus', projectId: 'variant-a-structural' }, 'tests/fixtures/u5b/reports/variant-a-structural.json');
    // The v1 re-evaluation of the same stored code: here the same report, so the v1-only set is empty.
    const corpusV1 = runDir('corpus-v1', { runId: 'e7-corpus-v1-000-variant-a-structural', planId: 'e7-corpus', projectId: 'variant-a-structural', instrumentVersion: 1 }, 'tests/fixtures/u5b/reports/variant-a-structural.json');
    const e1 = runDir('e1', { runId: 'e1-grid-000-cell-a', planId: 'e1-grid', projectId: 'cell-a', cell: E1_CELL }, 'tests/fixtures/u5b/reports/full-mode/correct-reference.json');
    const fixtures = runDir('fixtures', { runId: 'fixtures-000-correct-reference', planId: 'fixtures', projectId: 'correct-reference' }, 'tests/fixtures/u5b/reports/full-mode/correct-reference.json');
    const registered = { ...(JSON.parse(readFileSync(join(ROOT, 'corpus/label-plan-config.json'), 'utf8')) as LabelPlanConfig), provider: 'mock' as const };
    writeFileSync(join(tmp, 'config.json'), JSON.stringify(registered));
    const out = join(tmp, 'out');
    // ADR-026: with the registered v1-only size (6), the P2 frame is refused without the v1 re-evaluation.
    const refused = io();
    expect(await buildMain(['--out', out, '--config', join(tmp, 'config.json'), '--corpus-runs', corpus, '--e1-runs', e1, '--fixture-runs', fixtures, '--specs', SPEC], ROOT, refused.io)).toBe(1);
    expect(refused.err.join('')).toContain(`${LABEL_PLAN_INPUT_INVALID}: the v1-only P2 frame needs the v1 re-evaluation of every v2 corpus run (--corpus-v1-runs, ADR-026)`);
    const a = io();
    expect(await buildMain(['--out', out, '--config', join(tmp, 'config.json'), '--corpus-runs', corpus, '--corpus-v1-runs', corpusV1, '--e1-runs', e1, '--fixture-runs', fixtures, '--specs', SPEC], ROOT, a.io)).toBe(0);
    const plan = JSON.parse(readFileSync(join(out, 'label-plan.json'), 'utf8')) as LabelPlanFile;
    expect(plan.items.filter((i) => i.population === 'P3')).toHaveLength(0);
    // The two P3 strata stay in the plan with their sizes (so the population is described, never labelled).
    expect(plan.strata.filter((s) => s.population === 'P3')).toHaveLength(2);
    expect(plan.items.filter((i) => i.population === 'P2')).toHaveLength(9);
    expect(plan.auditSeed).toBe(6105);
    const summary = JSON.parse(readFileSync(join(out, 'label-plan-summary.json'), 'utf8')) as PlanSummary;
    expect(summary.escalated).toBe(false);
    expect(summary.context.cutByKind).toEqual({ violation: 0, 'judge-unit': 0, 'missed-seed': 0 });
    // Rows: E1 headline (2 units, p = 1/4 and 1/10: weights 4 and 10 -> n_eff = 196 / 116), fixtures, one generator,
    // P2 (9 strata, all kept: p = 1 / N_h, so n_eff = (sum N_h)^2 / sum N_h^2 < 9), the censuses.
    const rows = new Map(summary.precision.map((r) => [r.row, r]));
    expect(rows.get('P4 judge-vs-panel agreement, E1 headline')).toMatchObject({ n: 2, halfWidthAt50: null });
    expect(rows.get('P4 judge-vs-panel agreement, E1 headline')?.nEff).toBeCloseTo(196 / 116, 12);
    expect(rows.get('P4 judge-vs-panel agreement, fixtures')?.n).toBe(2);
    expect(rows.get('P4 judge-vs-panel agreement, generator claude-haiku-4-5')?.n).toBe(2);
    const p2 = plan.strata.filter((x) => x.population === 'P2').map((x) => x.size);
    const sum = p2.reduce((x, y) => x + y, 0);
    expect(rows.get(P2_ROW_V2)).toMatchObject({ n: 9, halfWidthAt50: null });
    expect(rows.get(P2_ROW_V2)?.nEff).toBeCloseTo((sum * sum) / p2.reduce((x, y) => x + y * y, 0), 12);
    expect(rows.get(P2_ROW_V2)?.nEff).toBeLessThan(9);
    // No exempted row: the v1 estimate equals the v2 one and the v1-only part is empty.
    expect(rows.get(P2_ROW_V1)).toEqual({ ...rows.get(P2_ROW_V2), row: P2_ROW_V1 });
    expect(rows.get(P2_ROW_V1_ONLY)).toEqual({ row: P2_ROW_V1_ONLY, n: 0, nEff: 0, halfWidthAt50: null, halfWidthAt85: null });
    expect(summary.p2Ceilings).toEqual({ v2: 9, v1Only: 0 });
    expect(a.out.join('')).toContain('cut at the ceiling: violation 0 (6000 chars), judge-unit 0 (32000 chars), missed-seed 0 (6000 chars)');
  });

  it('refuses a run whose spec is not among --specs and a known-bad config (--self-test)', async () => {
    const corpus = runDir('corpus', { runId: 'r', planId: 'e7-corpus', projectId: 'variant-a-structural', specSha: 'f'.repeat(64) }, 'tests/fixtures/u5b/reports/variant-a-structural.json');
    writeFileSync(join(tmp, 'config.json'), JSON.stringify(CONFIG));
    const a = io();
    expect(await buildMain(['--out', join(tmp, 'o'), '--config', join(tmp, 'config.json'), '--corpus-runs', corpus, '--specs', SPEC], ROOT, a.io)).toBe(1);
    expect(a.err.join('')).toContain(LABEL_PLAN_INPUT_INVALID);
    const b = io();
    expect(await buildMain(['--self-test'], ROOT, b.io)).toBe(1);
    expect(b.err.join('')).toContain('budgetCalls');
    expect(await buildMain(['--out', 'x', '--case', 'y'], ROOT, io().io)).toBe(2);
    // --bases goes only with a case (it is read only when a missed seed needs its prepared base).
    expect(await buildMain(['--out', 'x', '--bases', 'b.json'], ROOT, io().io)).toBe(2);
  });
});

describe('P2 v1-only stratum set (ADR-026; analysis plan §10 B8)', () => {
  const PROJECT = 'proj-a';
  const ROOT_REL = 'fixtures/correct-reference';
  const v = (functionId: string, filePath: string): Record<string, unknown> => ({ functionId, filePath: `src/${filePath}`, line: 1, route: 'symbolic' });
  // v2 report: FF-CV05 on 3 files, FF-S01, FF-P01 and FF-C01 on 1 each -> 4 strata, N = 6.
  const V2 = [
    v('FF-CV05', 'domain/entities/Task.ts'), v('FF-CV05', 'domain/entities/Category.ts'), v('FF-CV05', 'domain/repositories/ITaskRepository.ts'),
    v('FF-S01', 'application/use-cases/CreateTaskUseCase.ts'), v('FF-P01', 'domain/entities/Task.ts'), v('FF-C01', 'application/use-cases/CompleteTaskUseCase.ts'),
  ];
  // The rows the v2 role exemptions remove (v1 = v2 + these): FF-CV05 on 2 more files and FF-C02 on 2 -> 2 strata, N = 4.
  const EXEMPTED = [
    v('FF-CV05', 'domain/repositories/ICategoryRepository.ts'), v('FF-CV05', 'application/use-cases/ICompleteTaskUseCase.ts'),
    v('FF-C02', 'infrastructure/controllers/TaskController.ts'), v('FF-C02', 'infrastructure/repositories/InMemoryTaskRepository.ts'),
  ];
  // m = 3 P2 items: 2 from the v2 population, 1 from the v1-only set.
  const SMALL: LabelPlanConfig = {
    ...CONFIG, sampled: { P4: { perStratum: 1, maxItems: 0 }, P2: { perStratum: 1, maxItems: 3, strataDraw: 'pps', v1OnlyMaxItems: 1 }, P3: { perStratum: 1, maxItems: 0 } },
  };

  // The B8 mode pairing: a v1 re-evaluation is symbolic-only, the e7-corpus v2 runs are full mode (default by stamp).
  function reportRun(name: string, record: Record<string, unknown>, violations: readonly Record<string, unknown>[], evaluationMode?: string): string {
    const dir = join(tmp, name);
    mkdirSync(join(dir, 'runs'), { recursive: true });
    mkdirSync(join(dir, 'reports'), { recursive: true });
    const runId = String(record.runId);
    const mode = evaluationMode ?? (record.instrumentVersion === 1 ? 'symbolic-only' : 'full');
    writeFileSync(join(dir, 'reports', `${runId}.json`), JSON.stringify({ projectPath: ROOT_REL, evaluationMode: mode, violations }));
    writeFileSync(join(dir, 'runs', `${runId}.run.json`), JSON.stringify({
      attempt: 1, status: 'accepted', specSha: SPEC_SHA, cliCommit: 'c'.repeat(40), preregVersion: 11, frozenHashes: {}, envRecordId: 'test',
      startedAt: '2026-10-09T00:00:00.000Z', wallMs: 1, reportPath: `reports/${runId}.json`, planId: 'e7-corpus', projectId: PROJECT, ...record,
    }));
    return dir;
  }

  async function build(config: LabelPlanConfig, flags: readonly string[]): Promise<{ code: number; a: ReturnType<typeof io>; out: string }> {
    writeFileSync(join(tmp, 'config.json'), JSON.stringify(config));
    const out = join(tmp, 'out');
    const a = io();
    const code = await buildMain(['--out', out, '--config', join(tmp, 'config.json'), '--specs', SPEC, ...flags], ROOT, a.io);
    return { code, a, out };
  }

  it('draws each frame by PPS with its own probabilities; n and Kish n_eff per version (hand-computed)', async () => {
    const v2 = reportRun('v2', { runId: 'e7-corpus-000-proj-a', instrumentVersion: 2 }, V2);
    const v1 = reportRun('v1', { runId: 'e7-corpus-v1-000-proj-a', instrumentVersion: 1 }, [...V2, ...EXEMPTED]);
    const { code, a, out } = await build(SMALL, ['--corpus-runs', v2, '--corpus-v1-runs', v1]);
    expect(a.err.join('')).toBe('');
    expect(code).toBe(0);
    const plan = JSON.parse(readFileSync(join(out, 'label-plan.json'), 'utf8')) as LabelPlanFile;
    // v2 population, m = 2 over N = 6: FF-CV05 has 2 x 3 / 6 = 1 -> certain (pi 1, recorded as absent); then m' = 1 over
    // N' = 3: FF-C01, FF-P01, FF-S01 pi 1/3 each. v1-only set, m = 1 over N = 4: FF-C02 and FF-CV05 pi 2/4 = 1/2 each.
    expect(plan.strata.map((x) => [x.stratum, x.size, x.stratumInclusionProbability ?? 1])).toEqual([
      ['proj-a, FF-C01', 1, 1 / 3], ['proj-a, FF-CV05', 3, 1], ['proj-a, FF-P01', 1, 1 / 3], ['proj-a, FF-S01', 1, 1 / 3],
      ['v1-only: proj-a, FF-C02', 2, 0.5], ['v1-only: proj-a, FF-CV05', 2, 0.5],
    ]);
    const p2 = plan.items.filter((i) => i.population === 'P2');
    const v2Items = p2.filter((i) => !i.stratum.startsWith('v1-only: '));
    const v1Items = p2.filter((i) => i.stratum.startsWith('v1-only: '));
    // v2 items: FF-CV05 p = 1 x 1/3, the drawn singleton p = 1/3 x 1/1 -> both 1/3 (self-weighting). v1-only: p = 1/2 x 1/2.
    expect(v2Items).toHaveLength(2);
    expect(v2Items.some((i) => i.stratum === 'proj-a, FF-CV05')).toBe(true);
    for (const i of v2Items) expect(i.inclusionProbability).toBeCloseTo(1 / 3, 12);
    expect(v1Items).toHaveLength(1);
    expect(v1Items[0]?.inclusionProbability).toBe(0.25);
    // The v1-only item is an exempted row of the v1 run, never a v2 row.
    expect(v1Items[0]?.runId).toBe('e7-corpus-v1-000-proj-a');
    expect(['FF-C02', 'FF-CV05']).toContain(v1Items[0]?.functionId);
    expect(EXEMPTED.map((e) => e.filePath)).toContain((JSON.parse(v1Items[0]?.key ?? '[]') as unknown[])[1]);
    expect(v2Items.every((i) => i.runId === 'e7-corpus-000-proj-a')).toBe(true);
    const summary = JSON.parse(readFileSync(join(out, 'label-plan-summary.json'), 'utf8')) as PlanSummary;
    expect(summary.p2Items).toEqual({ v2: 2, v1Only: 1 });
    expect(summary.p2Ceilings).toEqual({ v2: 2, v1Only: 1 });
    // Weights: v2 3, 3; v1-only 4. v2: n 2, n_eff 36 / 18 = 2. v1 (both frames): n 3, n_eff 10^2 / 34. v1-only: n 1, n_eff 1.
    const rows = new Map(summary.precision.map((r) => [r.row, r]));
    expect(rows.get(P2_ROW_V2)?.n).toBe(2);
    expect(rows.get(P2_ROW_V2)?.nEff).toBeCloseTo(2, 12);
    expect(rows.get(P2_ROW_V1)?.n).toBe(3);
    expect(rows.get(P2_ROW_V1)?.nEff).toBeCloseTo(100 / 34, 12);
    expect(rows.get(P2_ROW_V1_ONLY)).toEqual({ row: P2_ROW_V1_ONLY, n: 1, nEff: 1, halfWidthAt50: null, halfWidthAt85: null });
    expect(a.out.join('')).toContain('P2 frames (ADR-026): v2 population 2 items, v1-only set 1 items');
    expect(a.out.join('')).toContain('ceilings: P4 0, P2 3 (v2 2, v1-only 1), P3 0');
    // Deterministic for the seeds.
    const again = await build(SMALL, ['--corpus-runs', v2, '--corpus-v1-runs', v1]);
    expect(again.code).toBe(0);
    expect(JSON.parse(readFileSync(join(again.out, 'label-plan.json'), 'utf8'))).toEqual(plan);
  });

  it('registered sizes 24 + 6: v2 n_eff 24; v1 Kish n_eff 27 < 30 because the two frames weigh differently', () => {
    // A hand-built frame: 24 v2 items with p = 1/2 (w 2) and 6 v1-only items with p = 1/4 (w 4).
    // v2: n_eff = 48^2 / 96 = 24, Wilson half-width at 24, p = 0.5: 0.185726. v1: (48 + 24)^2 / (96 + 96) = 27,
    // half-width at 27: 0.176466 (below 30 because the weights differ). v1-only: n 6, n_eff 6, counts only.
    const item = (stratum: string, p: number): LabelItem => ({ itemId: `${stratum}|${String(p)}`, kind: 'violation', population: 'P2', projectId: 'x', stratum, inclusionProbability: p, context: '' });
    const items = [...Array.from({ length: 24 }, (_, i) => item(`x, F${String(i)}`, 0.5)), ...Array.from({ length: 6 }, (_, i) => item(`v1-only: x, G${String(i)}`, 0.25))];
    const [v2, v1, only] = p2PrecisionRows(items);
    expect(v2).toMatchObject({ row: P2_ROW_V2, n: 24 });
    expect(v2?.nEff).toBeCloseTo(24, 12);
    expect(v2?.halfWidthAt50).toBeCloseTo(0.185726, 5);
    expect(v1).toMatchObject({ row: P2_ROW_V1, n: 30 });
    expect(v1?.nEff).toBeCloseTo(27, 12);
    expect(v1?.halfWidthAt50).toBeCloseTo(0.176466, 5);
    expect(only).toMatchObject({ row: P2_ROW_V1_ONLY, n: 6, halfWidthAt50: null, halfWidthAt85: null });
    expect(only?.nEff).toBeCloseTo(6, 12);
  });

  it('refuses a v1 run not stamped v1, a v2 run stamped v1, a v2 row the v1 report lacks, and a v1 run without its v2 pair', async () => {
    const v2 = reportRun('v2', { runId: 'e7-corpus-000-proj-a', instrumentVersion: 2 }, V2);
    const unstamped = reportRun('v1-unstamped', { runId: 'e7-corpus-v1-000-proj-a' }, [...V2, ...EXEMPTED]);
    let r = await build(SMALL, ['--corpus-runs', v2, '--corpus-v1-runs', unstamped]);
    expect(r.code).toBe(1);
    expect(r.a.err.join('')).toContain('is not stamped instrumentVersion 1');
    const v2AsV1 = reportRun('v2-as-v1', { runId: 'e7-corpus-000-proj-a', instrumentVersion: 1 }, V2);
    const v1 = reportRun('v1', { runId: 'e7-corpus-v1-000-proj-a', instrumentVersion: 1 }, [...V2, ...EXEMPTED]);
    r = await build(SMALL, ['--corpus-runs', v2AsV1, '--corpus-v1-runs', v1]);
    expect(r.code).toBe(1);
    expect(r.a.err.join('')).toContain('is instrument v1; --corpus-runs takes the v2 runs');
    const lacking = reportRun('v1-lacking', { runId: 'e7-corpus-v1-000-proj-a', instrumentVersion: 1 }, [...V2.slice(1), ...EXEMPTED]);
    r = await build(SMALL, ['--corpus-runs', v2, '--corpus-v1-runs', lacking]);
    expect(r.code).toBe(1);
    expect(r.a.err.join('')).toContain('has 1 violation(s) its v1 re-evaluation e7-corpus-v1-000-proj-a lacks');
    const other = reportRun('v1-other', { runId: 'e7-corpus-v1-000-proj-b', projectId: 'proj-b', instrumentVersion: 1 }, EXEMPTED);
    r = await build(SMALL, ['--corpus-runs', v2, '--corpus-v1-runs', `${v1},${other}`]);
    expect(r.code).toBe(1);
    expect(r.a.err.join('')).toContain('v1 corpus run e7-corpus-v1-000-proj-b: no accepted v2 corpus run of project proj-b');
    // With a registered v1-only size of 0 and no v1 runs the v2 population alone is drawn (the test configurations).
    r = await build({ ...SMALL, sampled: { ...SMALL.sampled, P2: { ...SMALL.sampled.P2, v1OnlyMaxItems: 0 } } }, ['--corpus-runs', v2]);
    expect(r.code).toBe(0);
  });

  it('mode pairing (B8 implementation rule): e7-corpus-v1sym symbolic-only records pair with full-mode e7-corpus runs by project and spec', async () => {
    // The full-mode v2 report also carries neuronal rows (P4 units): the symbolic-only v1 report has none, and that is
    // no "v2 row the v1 report lacks".
    const neural = [{ functionId: 'FF-N01', filePath: 'src/application/use-cases/CreateTaskUseCase.ts', route: 'neuronal' }];
    const v2 = reportRun('v2-full', { runId: 'e7-corpus-000-proj-a', instrumentVersion: 2 }, [...V2, ...neural], 'full');
    const v1 = reportRun('v1sym', { runId: 'e7-corpus-v1sym-000-proj-a', planId: 'e7-corpus-v1sym', instrumentVersion: 1 }, [...V2, ...EXEMPTED], 'symbolic-only');
    const { code, a, out } = await build(SMALL, ['--corpus-runs', v2, '--corpus-v1-runs', v1]);
    expect(a.err.join('')).toBe('');
    expect(code).toBe(0);
    const plan = JSON.parse(readFileSync(join(out, 'label-plan.json'), 'utf8')) as LabelPlanFile;
    const p2 = plan.items.filter((i) => i.population === 'P2');
    expect(p2.filter((i) => i.stratum.startsWith('v1-only: ')).map((i) => i.runId)).toEqual(['e7-corpus-v1sym-000-proj-a']);
    expect(p2.every((i) => i.functionId !== 'FF-N01')).toBe(true);
    expect(plan.strata.filter((x) => x.stratum.startsWith('v1-only: ')).map((x) => [x.stratum, x.size])).toEqual([['v1-only: proj-a, FF-C02', 2], ['v1-only: proj-a, FF-CV05', 2]]);
    // A symbolic-only v2 run pairs too (both carry the symbolic rows).
    const v2Sym = reportRun('v2-sym', { runId: 'e7-corpus-000-proj-a', instrumentVersion: 2 }, V2, 'symbolic-only');
    expect((await build(SMALL, ['--corpus-runs', v2Sym, '--corpus-v1-runs', v1])).code).toBe(0);
  });

  it('mode pairing refusals: a v1 report that is not symbolic-only, a neuronal-only or unmarked v2 report', async () => {
    const v2 = reportRun('v2-full', { runId: 'e7-corpus-000-proj-a', instrumentVersion: 2 }, V2, 'full');
    const v1Full = reportRun('v1-full', { runId: 'e7-corpus-v1sym-000-proj-a', planId: 'e7-corpus-v1sym', instrumentVersion: 1 }, [...V2, ...EXEMPTED], 'full');
    let r = await build(SMALL, ['--corpus-runs', v2, '--corpus-v1-runs', v1Full]);
    expect(r.code).toBe(1);
    expect(r.a.err.join('')).toContain('v1 corpus run e7-corpus-v1sym-000-proj-a has evaluationMode full; the v1 re-evaluation is symbolic-only');
    const v1 = reportRun('v1sym', { runId: 'e7-corpus-v1sym-000-proj-a', planId: 'e7-corpus-v1sym', instrumentVersion: 1 }, [...V2, ...EXEMPTED], 'symbolic-only');
    const v2Neural = reportRun('v2-neural', { runId: 'e7-corpus-000-proj-a', instrumentVersion: 2 }, V2, 'neuronal-only');
    r = await build(SMALL, ['--corpus-runs', v2Neural, '--corpus-v1-runs', v1]);
    expect(r.code).toBe(1);
    expect(r.a.err.join('')).toContain('v2 corpus run e7-corpus-000-proj-a has evaluationMode neuronal-only; a paired v2 run is full or symbolic-only');
    const v2Unmarked = reportRun('v2-unmarked', { runId: 'e7-corpus-000-proj-a', instrumentVersion: 2 }, V2, '');
    r = await build(SMALL, ['--corpus-runs', v2Unmarked, '--corpus-v1-runs', v1]);
    expect(r.code).toBe(1);
    expect(r.a.err.join('')).toContain('a paired v2 run is full or symbolic-only');
  });
});

describe('P1 and missed seeds from a scored case (SO4-02, SO4-01)', () => {
  it('score-golden --label-items -> plan (P1, MS, mechanical cause) -> labels -> score-golden --labels', async () => {
    // The hand-computed case with the current spec hash and one undeclared new FF-S01 violation in MO-S01's report.
    const caseDir = join(tmp, 'case');
    cpSync(join(ROOT, 'tests/fixtures/u5b/hand-computed'), caseDir, { recursive: true });
    const m = JSON.parse(readFileSync(join(caseDir, 'manifest.json'), 'utf8')) as { rows: { specSha256: string }[] };
    for (const r of m.rows) r.specSha256 = SPEC_SHA;
    writeFileSync(join(caseDir, 'manifest.json'), JSON.stringify(m));
    const seeded = JSON.parse(readFileSync(join(caseDir, 'reports/MO-S01.json'), 'utf8')) as { violations: Record<string, unknown>[] };
    seeded.violations.push({
      ...seeded.violations[0], id: 'v-0000000000000001', filePath: 'src/domain/entities/Category.ts', line: 3, lines: [3],
      message: 'src/domain/entities/Category.ts (domain) imports from src/infrastructure/repositories/InMemoryTaskRepository.ts (infrastructure)',
    });
    writeFileSync(join(caseDir, 'reports/MO-S01.json'), JSON.stringify(seeded));
    const rule = (r: string): ReturnType<typeof loadMatchingRule> => loadMatchingRule(r);
    const itemsFile = join(tmp, 'items.json');
    const s = io();
    expect(await scoreMain(['--case', caseDir, '--label-items', itemsFile], ROOT, s.io, rule)).toBe(0);
    const items = JSON.parse(readFileSync(itemsFile, 'utf8')) as LabelItemsFile;
    expect(items.p1).toHaveLength(1);
    expect(items.p1[0]).toMatchObject({ seedId: 'correct-reference:MO-S01:0', functionId: 'FF-S01', line: 3, twin: false });

    // Missed seeds: the MO-S01 row as missed (its site line in the unseeded tree is a comment: no rule applies -> MS),
    // and a copy marked outside coverage with an import() site (rule 1 -> RC-DYNAMIC-IMPORT, mechanical).
    const manifest = loadManifest(ROOT, join(caseDir, 'manifest.json'));
    if (!manifest.success) throw new Error('manifest');
    const s01 = manifest.data.rows.find((r) => r.operatorId === 'MO-S01');
    if (s01 === undefined) throw new Error('MO-S01 row');
    const dyn = { ...s01, seedId: 'correct-reference:MO-X99:0', operatorId: 'MO-X99', site: { ...s01.site, kind: 'dynamic-import' }, expected: { ...s01.expected, coverage: 'outside' } } as unknown as ManifestRow;
    const rows = new Map([...manifest.data.rows.map((r) => [r.seedId, r] as const), [dyn.seedId, dyn] as const]);
    const so4: So4Inputs = {
      items: { ...items, missed: [s01.seedId, dyn.seedId] }, rows, seededReport: () => ({}),
      seededRoot: () => join(ROOT, 'fixtures/correct-reference'), tsconfigPath: () => 'tsconfig.json',
      describe: (sha) => (sha === SPEC_SHA ? (fid: string) => `rule text of ${fid}` : undefined),
    };
    const built = buildLabelPlan({ config: CONFIG, so4, runs: [] });
    if (!built.ok) throw new Error(built.detail);
    expect(built.plan.items.map((i) => i.population)).toEqual(['P1', 'MS']);
    expect(built.plan.items[0]?.itemId).toBe(items.p1[0]?.itemId);
    expect(built.plan.items[0]?.context).toContain('Line: 3');
    expect(built.fnCauses).toEqual([{ seedId: dyn.seedId, rootCause: 'RC-DYNAMIC-IMPORT', rule: 1, source: 'mechanical', corroborated: false }]);
    expect(built.plan.items[1]?.seedId).toBe(s01.seedId);

    const labels = await label(built.plan, join(tmp, 'cassettes'));
    expect(labels.map((l) => [l.population, l.label])).toEqual([['P1', 'TP'], ['MS', 'FN']]);
    // instances.csv FN columns: the mechanical cause, and the labeller's root cause for the MS seed.
    expect(fnCauseColumns(dyn.seedId, built.fnCauses, labels)).toEqual(['RC-DYNAMIC-IMPORT', 'mechanical']);
    expect(fnCauseColumns(s01.seedId, built.fnCauses, labels)).toEqual(['RC-LAYER-MAP', 'labeller']);

    // score-golden --labels reads the llm-label output: the P1 item labelled TP leaves FP-labelled at 0 while
    // FP-strict stays 1; labels without the P1 item are refused.
    const labelsFile = join(tmp, 'labels.json');
    writeFileSync(labelsFile, JSON.stringify(labels));
    const scored = io();
    expect(await scoreMain(['--case', caseDir, '--labels', labelsFile], ROOT, scored.io, rule)).toBe(0);
    const score = JSON.parse(scored.out.join('')) as { overall: [string, { strict: { fp: number }; labelled: { fp: number } | null }][] };
    const withFp = score.overall.filter(([, v]) => v.strict.fp > 0);
    expect(withFp.length).toBeGreaterThan(0);
    for (const [, v] of withFp) expect(v.labelled?.fp).toBe(v.strict.fp - 1);
    writeFileSync(labelsFile, JSON.stringify(labels.filter((l) => l.population !== 'P1')));
    const refused = io();
    expect(await scoreMain(['--case', caseDir, '--labels', labelsFile], ROOT, refused.io, rule)).toBe(1);
    expect(refused.err.join('')).toContain(SCORE_LABELS_MISSING);
  });

  it('seeded copy root of a seed id', () => {
    expect(seededCopyRoot('/c', { seedId: 'p:MO-S01:3', projectId: 'p', operatorId: 'MO-S01' })).toBe('/c/p/MO-S01/k-3');
  });
});
