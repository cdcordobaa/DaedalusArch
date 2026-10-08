/**
 * U5b Step 29: audit allocation, blinding and agreement statistics (FR-27, ADR-017 item 7; BR-U5b-40..43; exit
 * criterion 4). Inputs: the committed Mock labeller fixture (Step 28) and U4's committed judge cassettes.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  AUDIT_MODIFIED, agreementStats, allocateAudit, auditView, checkAuditLock, labellingTables, loadLabellerPrompts, main, pairAgreement,
} from '../../../../scripts/llm-label.js';
import type { AnyLabel, AuditFile, JudgeUnitVerdict, LabelPlanFile, LabellerPrompt, LabellingOutputs, ReconciledLabel } from '../../../../scripts/llm-label.js';
import type { ItemKind } from '../../../../scripts/lib/label-context.js';
import { csvText } from '../../../../scripts/aggregate.js';
import { listCassetteKeys, readCassetteEntry } from '../../../../src/llm-critic/cassette-manager.js';
import { FIXTURE_MODEL, LABEL_CASSETTE_DIR, LABEL_FIXTURE_DIR } from './label-fixture.js';
import { ROOT } from './score-fixture.js';

const JUDGE_CASSETTES = 'tests/fixtures/judge-cassettes/correct-reference';

function prompts(): ReadonlyMap<ItemKind, LabellerPrompt> {
  const p = loadLabellerPrompts(ROOT);
  if (!p.ok) throw new Error(p.detail);
  return p.prompts;
}
function fixtureLabels(): ReconciledLabel[] {
  return JSON.parse(readFileSync(join(ROOT, LABEL_FIXTURE_DIR, 'expected-labels.json'), 'utf8')) as ReconciledLabel[];
}
function fixturePlanFile(): LabelPlanFile {
  return JSON.parse(readFileSync(join(ROOT, LABEL_FIXTURE_DIR, 'plan.json'), 'utf8')) as LabelPlanFile;
}
function judgeEntries(): NonNullable<Parameters<typeof agreementStats>[0]['judgeEntries']> {
  const dir = join(ROOT, JUDGE_CASSETTES);
  return listCassetteKeys(dir).flatMap((k) => {
    const e = readCassetteEntry(dir, k);
    return e === null ? [] : [e];
  });
}

/** Synthetic reconciled labels: `n` items of (kind, label) spread over three projects. */
function synthetic(kind: ItemKind, label: string, n: number): ReconciledLabel[] {
  return Array.from({ length: n }, (_, i) => ({
    itemId: `${kind}-${label}-${String(i).padStart(4, '0')}`, projectId: `p${String(i % 3)}`, kind, population: kind === 'judge-unit' ? 'P4' : kind === 'missed-seed' ? 'MS' : 'P2',
    stratum: 's', inclusionProbability: 1, label: label as ReconciledLabel['label'],
    runs: [
      { runIndex: 0, label: label as AnyLabel, rationale: 'PANEL-RATIONALE', cassetteKey: 'k0', attempts: 1 },
      { runIndex: 1, label: label as AnyLabel, rationale: 'PANEL-RATIONALE', cassetteKey: 'k1', attempts: 1 },
    ],
  }));
}

describe('audit allocation (BR-U5b-41)', () => {
  const labels = [
    ...synthetic('violation', 'TP', 200), ...synthetic('violation', 'FP', 40), ...synthetic('violation', 'unseeded-TP', 2),
    ...synthetic('judge-unit', 'fail', 30), ...synthetic('judge-unit', 'pass', 70), ...synthetic('missed-seed', 'FN', 5),
    ...synthetic('violation', 'uncertain', 9),
  ];

  it('strata {TP 200, FP 40, unseeded-TP 2, fail 30, pass 70, missed-seed 5}: floors kept, total 30, every kind, uncertain excluded', () => {
    const a = allocateAudit(labels, 11);
    const by = new Map(a.strata.map((s) => [`${s.kind}|${s.label}`, s]));
    expect(a.strata).toHaveLength(6);
    expect(by.has('violation|uncertain')).toBe(false);
    expect(a.strata.reduce((s, x) => s + x.allocated, 0)).toBe(30);
    expect(a.itemIds).toHaveLength(30);
    for (const s of a.strata) expect(s.allocated).toBeGreaterThanOrEqual(Math.min(3, s.size));
    expect(by.get('violation|unseeded-TP')?.allocated).toBe(2);
    expect(by.get('violation|TP')?.allocated).toBeGreaterThan(by.get('judge-unit|pass')?.allocated ?? 0);
    expect(new Set(a.strata.filter((s) => s.allocated > 0).map((s) => s.kind))).toEqual(new Set(['violation', 'judge-unit', 'missed-seed']));
    expect(by.get('violation|FP')?.samplingFraction).toBeCloseTo((by.get('violation|FP')?.allocated ?? 0) / 40, 12);
    expect(allocateAudit(labels, 11)).toEqual(a);
  });

  it('projects alternate within a stratum (round-robin in a seeded order)', () => {
    const a = allocateAudit(labels, 11);
    const project = new Map(labels.map((l) => [l.itemId, l.projectId]));
    const tp = a.itemIds.filter((id) => id.startsWith('violation-TP-')).map((id) => project.get(id));
    expect(tp.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < tp.length; i += 1) expect(tp[i]).not.toBe(tp[i - 1]);
    expect(new Set(tp.slice(0, 3)).size).toBe(3);
  });
});

describe('blinding (BR-U5b-42)', () => {
  it('the audit view model has no panel label, rationale or root-cause field', () => {
    const labels = fixtureLabels();
    const plan = fixturePlanFile();
    const view = auditView(allocateAudit(labels, 5), plan.items, prompts());
    expect(view.length).toBeGreaterThan(0);
    for (const v of view) {
      expect(Object.keys(v).sort()).toEqual(['context', 'itemId', 'kind', 'options', 'projectId', 'rootCauses']);
    }
    const text = JSON.stringify(view);
    for (const l of labels) for (const r of l.runs) if (r.rationale !== '') expect(text).not.toContain(r.rationale);
  });

  it('a modified audit file is refused after the first comparison (hash lock)', () => {
    const first = checkAuditLock(Buffer.from('{"records":[]}'), undefined, '2026-10-08T00:00:00Z');
    if (!first.ok) throw new Error(first.detail);
    expect(first.first).toBe(true);
    expect(checkAuditLock(Buffer.from('{"records":[]}'), first.lock, 'later')).toMatchObject({ ok: true, first: false });
    expect(checkAuditLock(Buffer.from('{"records":[{"itemId":"x"}]}'), first.lock, 'later')).toMatchObject({ ok: false, code: AUDIT_MODIFIED });
  });
});

describe('agreement (BR-U5b-40, 43)', () => {
  const labels = fixtureLabels();
  const p4 = labels.filter((l) => l.kind === 'judge-unit');
  const headline: JudgeUnitVerdict[] = p4.map((l, i) => ({ projectId: l.projectId, functionId: l.functionId ?? '', unitId: l.unitId ?? '', verdict: i === 0 ? 'pass' : 'fail', judgeModel: 'claude-opus-5-5' }));
  const allocation = allocateAudit(labels, 5);
  const byId = new Map(labels.map((l) => [l.itemId, l]));
  const audit: AuditFile = {
    version: 1, planId: 'fixtures',
    records: allocation.itemIds.map((id, i) => ({ itemId: id, label: i === 0 ? 'FP' : String(byId.get(id)?.label), recordedAt: '2026-10-08T00:00:00Z' })),
  };

  it('agreement.csv has exactly the three panel comparisons plus the judge-reliability rows', () => {
    const rows = agreementStats({ labels, prompts: prompts(), labellerModel: FIXTURE_MODEL, judgeVerdicts: headline, allocation, audit, judgeEntries: judgeEntries() });
    expect(rows.map((r) => r.comparison)).toEqual(['run-vs-run', 'judge-vs-panel', 'panel-vs-audit', 'judge-repetition', 'judge-repetition']);
    expect(rows.filter((r) => r.comparison === 'judge-repetition').map((r) => r.scope)).toEqual(['FF-N01', 'FF-N02']);
    for (const r of rows.filter((x) => x.comparison === 'judge-repetition')) {
      expect(r.percentAgreement).toBe(1); // the Mock fixture judge is consistent across its three samples
      expect(r.fleissKappa).toBe(1);
    }
    const rr = rows[0];
    expect(rr?.n).toBe(labels.filter((l) => l.runs.every((r) => r.label !== null)).length);
    expect(rr?.uncertain).toBe(labels.filter((l) => l.label === 'uncertain').length);
    expect(rows[1]).toMatchObject({ comparison: 'judge-vs-panel', scope: 'claude-opus-5-5', weighted: true, sameFamily: false, n: p4.filter((l) => l.label !== 'uncertain').length });
    expect(rows[2]).toMatchObject({ comparison: 'panel-vs-audit', weighted: true, n: allocation.itemIds.length });
    expect((rows[2]?.percentAgreement ?? 0)).toBeLessThan(1);
    const t = labellingTables({ agreement: rows })['agreement.csv'];
    expect(csvText(t.header, t.rows).trim().split('\n')).toHaveLength(1 + 5);
  });

  it('a judge-vs-panel cross-check on the labeller model gives a sameFamily row absent from the headline row', () => {
    const cross: JudgeUnitVerdict[] = p4.map((l) => ({ projectId: l.projectId, functionId: l.functionId ?? '', unitId: l.unitId ?? '', verdict: 'pass', judgeModel: FIXTURE_MODEL }));
    const base = agreementStats({ labels, prompts: prompts(), labellerModel: FIXTURE_MODEL, judgeVerdicts: headline });
    const rows = agreementStats({ labels, prompts: prompts(), labellerModel: FIXTURE_MODEL, judgeVerdicts: [...headline, ...cross] });
    const judge = rows.filter((r) => r.comparison === 'judge-vs-panel');
    expect(judge).toHaveLength(2);
    expect(judge[0]).toEqual(base.find((r) => r.comparison === 'judge-vs-panel'));
    expect(judge[0]?.sameFamily).toBe(false);
    expect(judge[1]).toMatchObject({ scope: FIXTURE_MODEL, sameFamily: true });
  });

  it('a known 2x2 table reproduces the hand-computed kappa and AC1 to 6 dp; weights enter the table', () => {
    const pairs = [
      ...Array.from({ length: 20 }, () => ({ a: 'pass', b: 'pass', w: 1 })), ...Array.from({ length: 5 }, () => ({ a: 'pass', b: 'fail', w: 1 })),
      ...Array.from({ length: 10 }, () => ({ a: 'fail', b: 'pass', w: 1 })), ...Array.from({ length: 15 }, () => ({ a: 'fail', b: 'fail', w: 1 })),
    ];
    const s = pairAgreement('judge-vs-panel', 'x', pairs, ['pass', 'fail'], false, 0);
    expect(s.percentAgreement?.toFixed(6)).toBe('0.700000');
    expect(s.cohensKappa?.toFixed(6)).toBe('0.400000');
    expect(s.gwetAc1?.toFixed(6)).toBe('0.405941');
    expect(s.ciMethod).toBe('wilson');
    // Inclusion probability 0.5 doubles an item's weight (P4 weighting).
    const w = pairAgreement('judge-vs-panel', 'x', [{ a: 'pass', b: 'pass', w: 2 }, { a: 'pass', b: 'fail', w: 1 }], ['pass', 'fail'], true, 0);
    expect(w.percentAgreement?.toFixed(6)).toBe('0.666667');
  });
});

describe('labeller tables in aggregate and the CLI (exit criterion 4)', () => {
  function io(): { out: string[]; err: string[]; files: Map<string, string>; io: { out: (t: string) => void; err: (t: string) => void; writeFile: (f: string, t: string) => void } } {
    const out: string[] = [];
    const err: string[] = [];
    const files = new Map<string, string>();
    return { out, err, files, io: { out: (t) => { out.push(t); }, err: (t) => { err.push(t); }, writeFile: (f, t) => { files.set(f, t); writeFileSync(f, t); } } };
  }

  it('replay of every Mock label, allocation, a written audit, agreement twice, then a modified audit is refused', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'u5b-audit-'));
    try {
      const plan = `${LABEL_FIXTURE_DIR}/plan.json`;
      const labelsOut = join(dir, 'labels.json');
      expect(await main(['--plan', plan, '--mode', 'replay', '--provider', 'mock', '--cassette-dir', LABEL_CASSETTE_DIR, '--model', FIXTURE_MODEL, '--out', labelsOut], ROOT, io().io)).toBe(0);
      expect(JSON.parse(readFileSync(labelsOut, 'utf8'))).toEqual(fixtureLabels());
      expect(await main(['--allocate-audit', '--plan', plan, '--labels', labelsOut, '--plan-id', 'fixtures', '--seed', '5', '--out', dir], ROOT, io().io)).toBe(0);
      const alloc = JSON.parse(readFileSync(join(dir, 'fixtures.allocation.json'), 'utf8')) as { itemIds: string[] };
      const view = JSON.parse(readFileSync(join(dir, 'fixtures.view.json'), 'utf8')) as unknown[];
      expect(view).toHaveLength(alloc.itemIds.length);
      const auditPath = join(dir, 'fixtures.json');
      writeFileSync(auditPath, JSON.stringify({ version: 1, planId: 'fixtures', records: alloc.itemIds.map((id) => ({ itemId: id, label: 'TP', recordedAt: '2026-10-08T00:00:00Z' })) }));
      const args = ['--agreement', '--plan', plan, '--labels', labelsOut, '--model', FIXTURE_MODEL, '--allocation', join(dir, 'fixtures.allocation.json'), '--audit', auditPath, '--judge-cassettes', JUDGE_CASSETTES, '--out', join(dir, 'labelling.json')];
      expect(await main(args, ROOT, io().io)).toBe(0);
      expect(await main(args, ROOT, io().io)).toBe(0);
      const outputs = JSON.parse(readFileSync(join(dir, 'labelling.json'), 'utf8')) as LabellingOutputs;
      expect(outputs.agreement?.map((r) => r.comparison)).toEqual(['run-vs-run', 'judge-vs-panel', 'panel-vs-audit', 'judge-repetition', 'judge-repetition']);
      const t = labellingTables(outputs);
      expect(t['label_budget.csv'].rows.length).toBe(fixturePlanFile().strata.length);
      expect(t['audit_allocation.csv'].rows.length).toBeGreaterThan(0);
      expect(t['fp_fn_taxonomy.csv'].rows.length).toBeGreaterThan(0);
      writeFileSync(auditPath, JSON.stringify({ version: 1, planId: 'fixtures', records: [] }));
      const refused = io();
      expect(await main(args, ROOT, refused.io)).toBe(1);
      expect(refused.err.join('')).toContain(AUDIT_MODIFIED);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
