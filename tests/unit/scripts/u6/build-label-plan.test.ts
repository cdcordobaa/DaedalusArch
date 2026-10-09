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
import { LABEL_PLAN_INPUT_INVALID, buildLabelPlan, main as buildMain, seededCopyRoot } from '../../../../scripts/build-label-plan.js';
import type { So4Inputs } from '../../../../scripts/build-label-plan.js';
import { LABEL_BUDGET_STOP, labelItems, loadLabellerPrompts } from '../../../../scripts/llm-label.js';
import type { LabelPlanFile, LabellerPrompt, ReconciledLabel } from '../../../../scripts/llm-label.js';
import type { ItemKind } from '../../../../scripts/lib/label-context.js';
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

const CONFIG: LabelPlanConfig = {
  version: 1, provider: 'mock', model: MODEL, budgetCalls: 300, reaskReserveCalls: 30, seeds: { strata: 6101, permutation: 6103, bootstrap: 6102 },
  priority: ['P4', 'P2', 'P3'], sampled: { P4: { perStratum: 1, maxItems: 46 }, P2: { perStratum: 1, maxItems: 20 }, P3: { perStratum: 1, maxItems: 10 } },
  exhaustivePlanned: 59, context: { maxChars: 6000 }, quota: { callsPerWeek: 180, minWeeks: 2 },
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
    expect(plan).toMatchObject({ sizing: 'registered', provider: 'mock', model: MODEL, permutationSeed: 6103, bootstrapSeed: 6102, budgetCalls: 300, reaskReserveCalls: 30 });
    // Every P2..P4 item names its run (FPAT rows key on it).
    expect(new Set(plan.items.map((i) => i.runId))).toEqual(new Set(['e7-corpus-000-variant-a-structural', 'e1-grid-000-cell-a', 'fixtures-000-correct-reference']));
    // Contexts: source window or unit source, never the judge verdict or rationale (BR-U5b-35).
    for (const i of plan.items) {
      expect(i.context.length).toBeLessThanOrEqual(6000);
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
    const fpat = fpatLabelsFromFile(labels, records, reports);
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
