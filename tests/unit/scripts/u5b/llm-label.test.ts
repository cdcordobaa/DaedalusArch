/**
 * U5b Step 28: labeller runs, cassettes and reconciliation (FR-27; BR-U5b-28, 29, 31, 32, 36, 37, 40, 44).
 *
 * The committed Mock fixture (`tests/fixtures/u5b/labels/plan.json`, cassettes in `tests/fixtures/u5b/cassettes/`,
 * `expected-labels.json`) is replayed with the provider disabled. `U5B_RECORD_LABEL_CASSETTES=1` re-records it with
 * the scripted Mock (own commit).
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  LABELLER_FAMILY_CONFLICT, LABELLER_MODEL_UNPINNED, checkLabellerModel, estimatePlan, itemPermutationSeed, labelItems,
  loadLabellerPrompts, main, parseAnswer, presentation, presentedOrder, reconcile, sameFamily, validateAnswer,
} from '../../../../scripts/llm-label.js';
import type { LabelPlanFile, LabelRun, LabellerConfig, LabellerPrompt, ReconciledLabel } from '../../../../scripts/llm-label.js';
import { ROOT_CAUSE_CODES, documentRootCauseTable } from '../../../../scripts/lib/matching-rule.js';
import type { LabelItem } from '../../../../scripts/lib/label-context.js';
import { listCassetteKeys, readCassetteEntry } from '../../../../src/llm-critic/cassette-manager.js';
import { DISABLED, FIXTURE_MODEL, LABEL_CASSETTE_DIR, LABEL_FIXTURE_DIR, ScriptedLabeller, fixturePlan } from './label-fixture.js';
import { ROOT } from './score-fixture.js';

const FIXED_NOW = (): string => '2026-10-08T00:00:00.000Z';
const RECORD = process.env.U5B_RECORD_LABEL_CASSETTES === '1';

function prompts(): ReadonlyMap<LabelItem['kind'], LabellerPrompt> {
  const p = loadLabellerPrompts(ROOT);
  if (!p.ok) throw new Error(p.detail);
  return p.prompts;
}
function prompt(kind: LabelItem['kind']): LabellerPrompt {
  const p = prompts().get(kind);
  if (p === undefined) throw new Error(kind);
  return p;
}
function config(over: Partial<LabellerConfig>): LabellerConfig {
  return {
    provider: DISABLED, model: FIXTURE_MODEL, runs: 2, mode: 'replay', cassetteDir: join(ROOT, LABEL_CASSETTE_DIR),
    permutationSeed: fixturePlan().permutationSeed, budgetCalls: 200, knownSecrets: [], now: FIXED_NOW, ...over,
  };
}
const dirs: string[] = [];
function tmp(): string {
  const d = mkdtempSync(join(tmpdir(), 'u5b-llm-label-'));
  dirs.push(d);
  return d;
}
afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

if (RECORD) {
  it('re-records the Mock fixture cassettes (U5B_RECORD_LABEL_CASSETTES=1)', async () => {
    const plan = fixturePlan();
    rmSync(join(ROOT, LABEL_CASSETTE_DIR), { recursive: true, force: true });
    mkdirSync(join(ROOT, LABEL_FIXTURE_DIR), { recursive: true });
    const r = await labelItems(plan.items, config({ provider: new ScriptedLabeller(), mode: 'record' }), prompts());
    if (!r.ok) throw new Error(r.detail);
    writeFileSync(join(ROOT, LABEL_FIXTURE_DIR, 'plan.json'), `${JSON.stringify(plan, null, 2)}\n`);
    writeFileSync(join(ROOT, LABEL_FIXTURE_DIR, 'expected-labels.json'), `${JSON.stringify(r.labels, null, 2)}\n`);
  });
}

describe('committed Mock fixture (BR-U5b-36; exit criterion 4 replay)', () => {
  it('the fixture plan rebuilds byte-identically from the fixture reports and sources (stable item ids)', () => {
    const committed = readFileSync(join(ROOT, LABEL_FIXTURE_DIR, 'plan.json'), 'utf8');
    expect(`${JSON.stringify(fixturePlan(), null, 2)}\n`).toBe(committed);
    const plan = JSON.parse(committed) as LabelPlanFile;
    expect(new Set(plan.items.map((i) => i.kind))).toEqual(new Set(['violation', 'judge-unit', 'missed-seed']));
    expect(new Set(plan.items.map((i) => i.itemId)).size).toBe(plan.items.length);
  });

  it('replay with the provider disabled reproduces every committed Mock label', async () => {
    const plan = JSON.parse(readFileSync(join(ROOT, LABEL_FIXTURE_DIR, 'plan.json'), 'utf8')) as LabelPlanFile;
    const expected = JSON.parse(readFileSync(join(ROOT, LABEL_FIXTURE_DIR, 'expected-labels.json'), 'utf8')) as ReconciledLabel[];
    const r = await labelItems(plan.items, config({}), prompts());
    if (!r.ok) throw new Error(r.detail);
    expect(JSON.parse(JSON.stringify(r.labels))).toEqual(expected);
    // The fixture covers every reconciliation path.
    const labels = new Set(expected.map((l) => l.label));
    for (const l of ['TP', 'FP', 'unseeded-TP', 'uncertain', 'pass', 'fail', 'FN']) expect(labels).toContain(l);
    expect(new Set(expected.flatMap((l) => (l.uncertainReason === undefined ? [] : [l.uncertainReason])))).toEqual(new Set(['disagree', 'invalid-run']));
    expect(expected.some((l) => l.runs.some((x) => x.attempts === 2 && x.label !== null))).toBe(true);
  });

  it('every committed cassette is scrubbed U4 v2 form with the pinned model, repetition 0 and functionId metadata', () => {
    const dir = join(ROOT, LABEL_CASSETTE_DIR);
    const keys = listCassetteKeys(dir);
    expect(keys.length).toBeGreaterThan(40);
    for (const key of keys) {
      const e = readCassetteEntry(dir, key);
      expect(e?.schemaVersion).toBe(2);
      expect(e?.model).toBe(FIXTURE_MODEL);
      expect(e?.repetition).toBe(0);
      expect([0, 1]).toContain(e?.runIndex);
      expect(e?.key).toBe(`${e?.requestHash ?? ''}-r0-${String(e?.runIndex)}`);
      expect(e?.functionId).toMatch(/^label:(violation|judge-unit|missed-seed):[0-9a-f]{64}$/);
      expect(JSON.stringify(e)).not.toMatch(/\/Users\/|\/home\/|AIza[0-9A-Za-z_-]{35}/);
    }
  });
});

describe('record, replay and keys (BR-U5b-36)', () => {
  it('label all Mock items in record mode, then replay with the provider disabled: identical ReconciledLabel[]', async () => {
    const dir = tmp();
    const plan = fixturePlan();
    const rec = await labelItems(plan.items, config({ provider: new ScriptedLabeller(), mode: 'record', cassetteDir: dir }), prompts());
    if (!rec.ok) throw new Error(rec.detail);
    const rep = await labelItems(plan.items, config({ cassetteDir: dir }), prompts());
    if (!rep.ok) throw new Error(rep.detail);
    expect(rep.labels).toEqual(rec.labels);
    expect(rep.calls).toBe(rec.calls);
  });

  it('re-evaluating the same project (same tree sha and keys) yields the same item ids', () => {
    expect(fixturePlan().items.map((i) => i.itemId)).toEqual(fixturePlan().items.map((i) => i.itemId));
  });

  it('a changed prompt is a cassette miss in replay', async () => {
    const plan = fixturePlan();
    const first = plan.items[0];
    if (first === undefined) throw new Error('empty plan');
    const changed: LabelItem = { ...first, context: `${first.context}\n(changed)` };
    const r = await labelItems([changed], config({}), prompts());
    expect(r).toMatchObject({ ok: false, code: 'CASSETTE_MISS' });
  });

  it('run 0 and run 1 request the same pinned model id, temperature 0, and the cassette entries store it', async () => {
    const dir = tmp();
    const mock = new ScriptedLabeller();
    const plan = fixturePlan();
    const r = await labelItems(plan.items.slice(0, 3), config({ provider: mock, mode: 'record', cassetteDir: dir }), prompts());
    expect(r.ok).toBe(true);
    expect(new Set(mock.calls.map((c) => c.options.model))).toEqual(new Set([FIXTURE_MODEL]));
    expect(new Set(mock.calls.map((c) => c.options.temperature))).toEqual(new Set([0]));
    expect(new Set(mock.calls.map((c) => c.call?.runIndex))).toEqual(new Set([0, 1]));
    for (const key of listCassetteKeys(dir)) expect(readCassetteEntry(dir, key)?.model).toBe(FIXTURE_MODEL);
  });
});

describe('model pinning and family (BR-U5b-31, 40)', () => {
  it('a labeller configuration without a pinned id is LABELLER_MODEL_UNPINNED; a Claude id is a family conflict', async () => {
    expect(checkLabellerModel('')).toMatchObject({ ok: false, code: LABELLER_MODEL_UNPINNED });
    expect(checkLabellerModel(undefined)).toMatchObject({ ok: false, code: LABELLER_MODEL_UNPINNED });
    expect(checkLabellerModel('claude-opus-5-5')).toMatchObject({ ok: false, code: LABELLER_FAMILY_CONFLICT });
    expect(checkLabellerModel('gemini-2.5-pro-002')).toEqual({ ok: true });
    const r = await labelItems(fixturePlan().items, config({ model: '' }), prompts());
    expect(r).toMatchObject({ ok: false, code: LABELLER_MODEL_UNPINNED });
  });

  it('sameFamily is set when the cross-check judge model equals (or shares the family of) the labeller model', () => {
    expect(sameFamily('gemini-2.5-pro-002', 'gemini-2.5-pro-002')).toBe(true);
    expect(sameFamily('gemini-2.5-pro-002', 'gemini-2.5-flash')).toBe(true);
    expect(sameFamily('gemini-2.5-pro-002', 'claude-opus-5-5')).toBe(false);
  });
});

describe('run diversity and map-back (BR-U5b-32)', () => {
  it('run 1 presents the recorded permutation; "option 2" maps back to the canonical label at that position', () => {
    const p = prompt('violation');
    const seed = itemPermutationSeed(20261008, 'a'.repeat(64));
    const perm = presentedOrder(p.options.length, seed);
    const shown = presentation(p, seed);
    expect(shown.options).toEqual(perm.map((i) => p.options[i]));
    expect(presentation(p, seed)).toEqual(shown); // same stored seed, same order
    expect(presentation(p, undefined).options).toEqual(p.options); // run 0: canonical
    const second = perm[1] ?? -1;
    const a = parseAnswer(JSON.stringify({ option: 2, rootCause: null, rationale: 'r' }), shown);
    expect(a).toMatchObject({ ok: true, answer: { label: p.options[second] } });
    // Root causes are permuted independently and mapped back too.
    const rc = parseAnswer(JSON.stringify({ option: 1, rootCause: 3, rationale: 'r' }), shown);
    expect(rc.ok && rc.answer.rootCause).toBe(shown.rootCauses[2]);
    expect(new Set(shown.rootCauses)).toEqual(new Set(p.rootCauses));
  });
});

describe('validity (BR-U5b-29)', () => {
  const v = prompt('violation');
  it('FP without root cause, TP with RC-GENUINE-UNSEEDED and RC-OTHER without a note are invalid', () => {
    expect(validateAnswer(v, { label: 'FP', rationale: 'r' })).toMatch(/requires a root cause/);
    expect(validateAnswer(v, { label: 'TP', rootCause: 'RC-GENUINE-UNSEEDED', rationale: 'r' })).toMatch(/only with unseeded-TP/);
    expect(validateAnswer(v, { label: 'FP', rootCause: 'RC-OTHER', note: ' ', rationale: 'r' })).toMatch(/non-empty note/);
    expect(validateAnswer(v, { label: 'FP', rootCause: 'RC-OTHER', note: 'n', rationale: 'r' })).toBeNull();
    expect(validateAnswer(v, { label: 'TP', rationale: 'r' })).toBeNull();
    expect(validateAnswer(v, { label: 'unseeded-TP', rootCause: 'RC-GENUINE-UNSEEDED', rationale: 'r' })).toBeNull();
  });

  it('an invalid answer is re-asked once and then recorded invalid (uncertain, invalid-run)', () => {
    const expected = JSON.parse(readFileSync(join(ROOT, LABEL_FIXTURE_DIR, 'expected-labels.json'), 'utf8')) as ReconciledLabel[];
    const twice = expected.filter((l) => l.uncertainReason === 'invalid-run');
    expect(twice.length).toBeGreaterThan(0);
    for (const l of twice) {
      const bad = l.runs.filter((r) => r.label === null);
      expect(bad.length).toBeGreaterThan(0);
      for (const r of bad) {
        expect(r.attempts).toBe(2);
        expect(r.invalidReason).toMatch(/RC-OTHER requires a non-empty note/);
      }
    }
    const recovered = expected.filter((l) => l.runs.some((r) => r.attempts === 2 && r.label !== null));
    expect(recovered.every((l) => l.runs.every((r) => r.rootCause === 'RC-SPEC-PARAM'))).toBe(true);
  });
});

describe('reconciliation (BR-U5b-37)', () => {
  const v = prompt('violation');
  const first = fixturePlan().items[0];
  if (first === undefined) throw new Error('empty fixture plan');
  const item: LabelItem = first;
  const run = (runIndex: 0 | 1, label: LabelRun['label'], rootCause?: LabelRun['rootCause']): LabelRun => ({
    runIndex, label, rationale: 'r', cassetteKey: 'k', attempts: 1, ...(rootCause !== undefined && { rootCause }),
  });
  it('(FP, RC-LAYER-MAP) vs (FP, RC-TEST-CODE) → uncertain; (TP, –) vs (TP, RC-OTHER) → TP; invalid → invalid-run', () => {
    expect(reconcile(item, v, [run(0, 'FP', 'RC-LAYER-MAP'), run(1, 'FP', 'RC-TEST-CODE')])).toMatchObject({ label: 'uncertain', uncertainReason: 'disagree' });
    const tp = reconcile(item, v, [run(0, 'TP'), run(1, 'TP', 'RC-OTHER')]);
    expect(tp.label).toBe('TP');
    expect(tp.rootCause).toBeUndefined();
    expect(reconcile(item, v, [run(0, 'FP', 'RC-LAYER-MAP'), run(1, 'FP', 'RC-LAYER-MAP')])).toMatchObject({ label: 'FP', rootCause: 'RC-LAYER-MAP' });
    expect(reconcile(item, v, [run(0, null), run(1, 'TP')])).toMatchObject({ label: 'uncertain', uncertainReason: 'invalid-run' });
    expect(reconcile(item, v, [run(0, 'TP'), run(1, 'FP', 'RC-LAYER-MAP')])).toMatchObject({ label: 'uncertain', uncertainReason: 'disagree' });
  });
});

describe('root-cause list (BR-U5b-28)', () => {
  it('the RootCauseCode union, Docs/matching-rule.md and every Docs/labeller-prompts/*.md list are equal as sets (12)', () => {
    const union = new Set<string>(ROOT_CAUSE_CODES);
    expect(union.size).toBe(12);
    expect(new Set(documentRootCauseTable(readFileSync(join(ROOT, 'Docs/matching-rule.md'), 'utf8')))).toEqual(union);
    const files = readdirSync(join(ROOT, 'Docs/labeller-prompts')).filter((f) => f.endsWith('.md'));
    expect(files.sort()).toEqual(['judge-unit.md', 'missed-seed.md', 'violation.md']);
    for (const p of prompts().values()) expect(new Set(p.rootCauses)).toEqual(union);
    // The human-readable table of each prompt document lists the same codes.
    for (const f of files) {
      const table = [...readFileSync(join(ROOT, 'Docs/labeller-prompts', f), 'utf8').matchAll(/^\| `(RC-[A-Z-]+)` \|/gm)].map((m) => m[1]);
      expect(new Set(table)).toEqual(union);
    }
  });
});

describe('llm-label main (BR-U5b-34, 44, 73)', () => {
  function io(): { out: string[]; err: string[]; files: Map<string, string>; io: { out: (t: string) => void; err: (t: string) => void; writeFile: (f: string, t: string) => void } } {
    const out: string[] = [];
    const err: string[] = [];
    const files = new Map<string, string>();
    return { out, err, files, io: { out: (t) => { out.push(t); }, err: (t) => { err.push(t); }, writeFile: (f, t) => { files.set(f, t); } } };
  }
  const PLAN = `${LABEL_FIXTURE_DIR}/plan.json`;

  it('without --mode replay or --mode record it exits with usage', async () => {
    const a = io();
    expect(await main(['--plan', PLAN, '--cassette-dir', LABEL_CASSETTE_DIR, '--model', FIXTURE_MODEL, '--out', 'x.json'], ROOT, a.io)).toBe(2);
    expect(a.err.join('')).toContain('usage:');
    const b = io();
    expect(await main(['--plan', PLAN, '--mode', 'bypass', '--cassette-dir', LABEL_CASSETTE_DIR, '--model', FIXTURE_MODEL, '--out', 'x.json'], ROOT, b.io)).toBe(2);
  });

  it('--mode replay --provider mock reproduces the committed labels; --self-test exits 1; no pinned model exits 1', async () => {
    const a = io();
    expect(await main(['--plan', PLAN, '--mode', 'replay', '--provider', 'mock', '--cassette-dir', LABEL_CASSETTE_DIR, '--model', FIXTURE_MODEL, '--out', 'out/labels.json'], ROOT, a.io)).toBe(0);
    const written = [...a.files.values()][0] ?? '';
    expect(JSON.parse(written)).toEqual(JSON.parse(readFileSync(join(ROOT, LABEL_FIXTURE_DIR, 'expected-labels.json'), 'utf8')));
    expect(await main(['--self-test'], ROOT, io().io)).toBe(1);
    const c = io();
    expect(await main(['--plan', PLAN, '--mode', 'replay', '--cassette-dir', LABEL_CASSETTE_DIR, '--out', 'x.json'], ROOT, c.io)).toBe(1);
    expect(c.err.join('')).toContain(LABELLER_MODEL_UNPINNED);
  });

  it('--estimate prints the call count within budget (exit 0) and refuses above it (exit 1)', async () => {
    const plan = fixturePlan();
    const a = io();
    expect(await main(['--plan', PLAN, '--estimate'], ROOT, a.io)).toBe(0);
    expect(a.out.join('')).toContain(`estimate: ${String(plan.items.length * 2)} calls`);
    const dir = tmp();
    writeFileSync(join(dir, 'small.json'), JSON.stringify({ ...plan, budgetCalls: 2 }));
    const b = io();
    expect(await main(['--plan', join(dir, 'small.json'), '--estimate'], ROOT, b.io)).toBe(1);
    expect(estimatePlan({ ...plan, budgetCalls: 2 }).exitCode).toBe(1);
    expect(existsSync(join(ROOT, 'out'))).toBe(false);
  });
});
