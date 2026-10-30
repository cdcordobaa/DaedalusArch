/**
 * Delivered = scored at study time (`experiments/v15-study/lib/delivery-audit.ts`) and the Hexagonal study's counted
 * list (`score-study.ts`, `HX_COUNTED_RULES`). Zero model calls, no Neo4j: a real hub on a sealed HCAL-03 case, the
 * audit around its two test seams, and the scorer's own rules on the same tree.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { checkConsistency } from '../../../src/v15-instrument/consistency.js';
import { DeliveryHub } from '../../../src/v15-instrument/delivery/hub.js';
import { checkLayers } from '../../../src/v15-instrument/edit-gate/layers.js';
import { loadRules } from '../../../src/v15-instrument/graph.js';
import { cypherRules, frozenRules, scoredRules } from '../../../src/v15-instrument/rule-set.js';
import { DeliveryAudit, auditVerdict, findingsAgreement, treeDigest, type CheckRecord } from '../../../experiments/v15-study/lib/delivery-audit.js';
import { HX_COUNTED_RULES, HX_MIRROR2_SHAPES, hxCounted, hxCountedRuleIds, mirror2Shape, scoreTreeV15 } from '../../../experiments/v15-study/score-study.js';

const REPO = path.resolve(__dirname, '..', '..', '..');
const MUSEUM = path.join(REPO, 'experiments', 'hcal-03', 'museum-loans');
const post = (cwd: string, file: string): string =>
  JSON.stringify({ session_id: 's', cwd, hook_event_name: 'PostToolUse', tool_name: 'Write', tool_input: { file_path: path.join(cwd, file), content: 'x' } });

describe('Hexagonal study counted list (pinned; draft pre-registration §1 and §10)', () => {
  it('is the literal list, every id is a scored Hexagonal rule, and the advisory and non-admitted rules are out', () => {
    expect(HX_COUNTED_RULES).toEqual(['FF-P01', 'FF-P03', 'FF-S01', 'FF-S04', 'R-AXA', 'R-COREIO', 'R-ENTITY-OUT', 'R-H5', 'R-INJ', 'R-LOCATOR', 'R-TRANSPORT']);
    expect(HX_MIRROR2_SHAPES).toEqual({ i: ['literal', 'error'], ii: 'all' });
    for (const id of hxCountedRuleIds()) expect(scoredRules('hexagonal')).toContain(id);
    for (const id of ['FF-S03', 'FF-P02', 'R-MIRROR', 'R-MIRROR-SEM', 'R-ADAPTER-RULE']) {
      expect(hxCounted({ rule: id }, 'i')).toBe(false);
      expect(hxCounted({ rule: id }, 'ii')).toBe(false);
    }
  });

  it('counts R-MIRROR2 by shape word: (i) literal and error only, (ii) every shape', () => {
    expect(mirror2Shape('R-MIRROR2', "[error] src/domain/errors.ts:23 FurPayDecline copies …")).toBe('error');
    expect(mirror2Shape('R-MIRROR2', '[field-list] src/a.ts:3 X lists …')).toBe('field-list');
    expect(mirror2Shape('R-MIRROR', '[literal] x')).toBeUndefined();
    for (const shape of ['literal', 'error']) expect(hxCounted({ rule: 'R-MIRROR2', shape }, 'i')).toBe(true);
    for (const shape of ['field', 'field-set', 'field-list', 'decl']) {
      expect(hxCounted({ rule: 'R-MIRROR2', shape }, 'i')).toBe(false);
      expect(hxCounted({ rule: 'R-MIRROR2', shape }, 'ii')).toBe(true);
    }
    expect(hxCounted({ rule: 'R-MIRROR2' }, 'i')).toBe(false); // no shape word: not counted under (i)
    expect(hxCounted({ rule: 'R-AXA' })).toBe(true);
  });
});

describe('delivery audit: verdicts', () => {
  const rec = (kind: 'cypher' | 'frozen', ran: readonly string[], extra: Partial<CheckRecord> = {}): CheckRecord => ({ n: 1, turn: 'step-01', kind, requested: ran, ran, files: null, treeDigest: 'd', findings: [], ...extra });
  const full = [rec('cypher', cypherRules('hexagonal').sort()), rec('frozen', frozenRules('hexagonal').sort())];

  it('passes the full scored lists and flags a DEV-3-like list', () => {
    expect(auditVerdict(full, 'hexagonal', hxCountedRuleIds(), { require: true }).flagged).toBe(false);
    const dev3 = auditVerdict([rec('cypher', ['R-D4', 'R-XCTX']), rec('frozen', ['FF-S01', 'FF-S02', 'FF-S03'])], 'hexagonal', hxCountedRuleIds(), { require: true });
    expect(dev3.flagged).toBe(true);
    expect(dev3.mismatches[0]!.missing).toContain('R-AXA');
    expect(dev3.countedNotDelivered).toContain('R-AXA');
  });

  it('a missing audit is flagged only when required; a session with no check is not flagged', () => {
    expect(auditVerdict(undefined, 'hexagonal', hxCountedRuleIds(), { require: true }).flagged).toBe(true);
    expect(auditVerdict(undefined, 'hexagonal', hxCountedRuleIds(), { require: false }).flagged).toBe(false);
    expect(auditVerdict([], 'hexagonal', hxCountedRuleIds(), { require: true }).flagged).toBe(false);
    // only Cypher checks ran (nothing changed against the seed): the frozen counted rules are not held against it
    expect(auditVerdict([full[0]!], 'hexagonal', hxCountedRuleIds(), { require: true }).flagged).toBe(false);
  });

  it('findings agreement leaves R-MIRROR-SEM out and is not comparable on a neutralised or unseen tree', () => {
    const r = rec('cypher', ['R-AXA', 'R-MIRROR-SEM'], { treeDigest: 'abc', files: ['a.ts'], findings: ['R-AXA|a.ts|3', 'R-MIRROR-SEM|a.ts|1'] });
    expect(findingsAgreement([r], 'abc', [{ rule: 'R-AXA', file: 'a.ts', line: 3 }, { rule: 'R-AXA', file: 'b.ts', line: 1 }], { neutralised: false })).toEqual({ comparable: true, records: 1, onlyHub: [], onlyScorer: [] });
    expect(findingsAgreement([r], 'abc', [], { neutralised: false }).onlyHub).toEqual(['R-AXA|a.ts|3']);
    expect(findingsAgreement([r], 'abc', [], { neutralised: true }).comparable).toBe(false);
    expect(findingsAgreement([r], 'zzz', [], { neutralised: false }).comparable).toBe(false);
  });
});

describe('delivery audit around a real hub (gate (a) on a sealed HCAL-03 case)', () => {
  let tmp: string;
  beforeAll(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v15-audit-')); });
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('records the scored lists and the hub digest on a push, and the scorer finds the same on that tree', async () => {
    const seed = path.join(MUSEUM, 'base');
    const spec = path.join(seed, 'spec.yaml');
    const file = 'src/adapters/in/http/loan.controller.ts';
    const work = path.join(tmp, 'work');
    fs.cpSync(seed, work, { recursive: true });
    fs.mkdirSync(path.join(tmp, 'sock'), { recursive: true });
    const audit = new DeliveryAudit();
    const hub = new DeliveryHub(path.join(tmp, 'sock', 'h.sock'), null, path.join(tmp, 'logs'), { check: audit.wrapCheck(checkConsistency), checkLayers: audit.wrapLayers(checkLayers) });
    await hub.start();
    try {
      await hub.setCell({ id: 'audit', session: null, step: 's1', turn: 't1', spec, project: work, baseline: seed });
      audit.records.length = 0;
      audit.turn = 'step-01';
      fs.copyFileSync(path.join(MUSEUM, 'cases', 'H03-pos1', file), path.join(work, file));
      await hub.handleHook(post(work, file));
    } finally {
      hub.closeCell();
      await hub.stop();
    }
    const v = auditVerdict(audit.records, 'hexagonal', hxCountedRuleIds(), { require: true });
    expect(v).toMatchObject({ present: true, flagged: false, mismatches: [] });
    expect(audit.records.map((r) => r.kind).sort()).toEqual(['cypher', 'frozen']);
    const pushLine = fs.readFileSync(path.join(tmp, 'logs', 'audit.push.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as { treeDigest?: string }).at(-1);
    expect(audit.records[0]!.treeDigest).toBe(treeDigest(work));
    expect(pushLine?.treeDigest).toBe(treeDigest(work));
    expect(audit.records[0]!.findings.some((k) => k.startsWith('R-AXA|'))).toBe(true);
    const r = await scoreTreeV15(work, loadRules(), spec, path.join(tmp, '_s'), seed);
    const hits = r.findings.filter((f) => f.status === 'violation').map((f) => ({ rule: f.rule, file: f.file, line: f.line }));
    expect(findingsAgreement(audit.records, treeDigest(work), hits, { neutralised: false })).toMatchObject({ comparable: true, onlyHub: [], onlyScorer: [] });
  }, 120_000);
});
