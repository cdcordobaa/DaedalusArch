import type { Finding } from '../../../../../scripts/v1.3/lib/labelling/findings.js';
import { PER_RULE_CAP, allocate, notApplicable, sampleFindings } from '../../../../../scripts/v1.3/lib/labelling/sampler.js';
import type { SampledFinding } from '../../../../../scripts/v1.3/lib/labelling/sampler.js';
import { AUDIT_MIN, agreement, answersTemplate, auditAgreement, auditKey, auditSheet, auditTable, parseAnswerTable, parseCsv, selectAudit, selectAuditStratified } from '../../../../../scripts/v1.3/lib/labelling/audit.js';

function f(i: number, ruleId: string, projectId: string, extra: Partial<Finding> = {}): Finding {
  return {
    key: `${ruleId}-${projectId}-${String(i).padStart(4, '0')}`, projectId, style: 'clean-architecture', ruleId,
    template: ruleId === 'FF-S01' ? 'dependency-direction' : 'domain-purity', type: 'X', tier: 'blocking',
    file: `src/domain/F${String(i)}.ts`, discriminator: [], evidence: [], message: `FF-S01 Violation ${String(i)}`, ...extra,
  };
}

describe('sampler', () => {
  it('keeps every finding of a rule with fewer than 40', () => {
    const s = sampleFindings(Array.from({ length: 39 }, (_, i) => f(i, 'FF-P01', `p${String(i % 3)}`)), 7);
    expect(s.rules[0]).toMatchObject({ population: 39, sampled: 39, exhaustive: true });
    expect(s.items.every((x) => x.inclusionProbability === 1)).toBe(true);
  });

  it('draws a seeded 40, stratified by project in proportion to size', () => {
    const findings = [
      ...Array.from({ length: 150 }, (_, i) => f(i, 'FF-S01', 'big')),
      ...Array.from({ length: 50 }, (_, i) => f(i, 'FF-S01', 'small')),
    ];
    const a = sampleFindings(findings, 42);
    const b = sampleFindings([...findings].reverse(), 42);
    const c = sampleFindings(findings, 43);
    expect(a.rules[0]).toMatchObject({ population: 200, sampled: PER_RULE_CAP, exhaustive: false });
    expect(a.rules[0]?.perProject).toEqual({ big: { population: 150, sampled: 30 }, small: { population: 50, sampled: 10 } });
    expect(a.items.map((x) => x.key)).toEqual(b.items.map((x) => x.key));
    expect(a.items.map((x) => x.key)).not.toEqual(c.items.map((x) => x.key));
    expect(a.items[0]?.inclusionProbability).toBeCloseTo(0.2);
  });

  it('samples blocking rules only by default and leaves out the N/A part of a partial rule', () => {
    const flows = f(1, 'FF-P06', 'p', { template: 'domain-state-purity', discriminator: ['C', 'T', 'FLOWS_TO', 'x'] });
    const inject = f(2, 'FF-P06', 'p', { template: 'domain-state-purity', discriminator: ['C', 'T', 'CONSTRUCTOR_INJECTS', 'x'] });
    const advisory = f(3, 'FF-C02', 'p', { tier: 'advisory', template: 'module-fan-out' });
    expect(notApplicable(flows)).toBe(true);
    const s = sampleFindings([flows, inject, advisory], 1);
    expect(s.items.map((x) => x.key)).toEqual([inject.key]);
    expect(s.excludedNotApplicable).toEqual({ 'FF-P06/domain-state-purity': 1 });
    expect(sampleFindings([advisory], 1, 'all').items).toHaveLength(1);
  });

  it('allocates by largest remainder without exceeding a stratum', () => {
    const q = allocate(new Map([['a', 1], ['b', 100], ['c', 100]]), 40, ['a', 'b', 'c']);
    expect([...q.values()].reduce((x, y) => x + y, 0)).toBe(40);
    expect(q.get('a')).toBeLessThanOrEqual(1);
  });
});

describe('author audit', () => {
  const items: SampledFinding[] = [
    ...Array.from({ length: 25 }, (_, i) => ({ ...f(i, 'FF-S01', 'p'), rule: 'FF-S01/dependency-direction', inclusionProbability: 1 })),
    ...Array.from({ length: 10 }, (_, i) => ({ ...f(i, 'FF-P01', 'q', { target: 'express' }), rule: 'FF-P01/domain-purity', inclusionProbability: 1 })),
  ];

  it('needs at least 30 items and represents every rule', () => {
    expect(() => selectAudit(items, 29, 1)).toThrow(/at least 30/);
    expect(() => selectAudit(items.slice(0, 20), 30, 1)).toThrow(/only 20/);
    const chosen = selectAudit(items, AUDIT_MIN, 5);
    expect(chosen).toHaveLength(30);
    expect(chosen.filter((c) => c.rule === 'FF-P01/domain-purity')).toHaveLength(10);
    expect(selectAudit(items, 30, 5).map((c) => c.key)).toEqual(chosen.map((c) => c.key));
  });

  it('writes a sheet blind to the rule id, and a separate key', () => {
    const chosen = selectAudit(items, 30, 5);
    const sheet = auditSheet(chosen, () => 'line1\nline2');
    expect(sheet).not.toMatch(/FF-[A-Z]+\d/);
    expect(sheet).not.toContain('dependency-direction');
    expect(sheet).toContain('## A030');
    expect(auditKey(chosen)[0]).toMatchObject({ auditId: 'A001', key: chosen[0]?.key, rule: chosen[0]?.rule });
    expect(answersTemplate(chosen).split('\n')[0]).toBe('auditId,meaningful,correct,note');
  });

  it('computes kappa, AC1 and a Wilson interval, and gates on kappa >= 0.60', () => {
    const perfect = agreement([['yes', 'yes'], ['no', 'no'], ['yes', 'yes'], ['no', 'no']], ['yes', 'no']);
    expect(perfect.kappa).toBeCloseTo(1);
    expect(perfect.observed).toBe(1);
    // 2x2 table [[20,5],[5,10]]: po 0.75, pe 0.53125 -> kappa 0.4667.
    const pairs: [string, string][] = [
      ...Array.from({ length: 20 }, (): [string, string] => ['yes', 'yes']), ...Array.from({ length: 5 }, (): [string, string] => ['yes', 'no']),
      ...Array.from({ length: 5 }, (): [string, string] => ['no', 'yes']), ...Array.from({ length: 10 }, (): [string, string] => ['no', 'no']),
    ];
    const a = agreement(pairs, ['yes', 'no']);
    expect(a.kappa).toBeCloseTo(0.4667, 3);
    expect(a.observedLow).toBeLessThan(0.75);
    expect(a.observedHigh).toBeGreaterThan(0.75);

    const chosen = selectAudit(items, 30, 5);
    const key = auditKey(chosen);
    const answers = parseCsv(['auditId,meaningful,correct,note', ...key.map((k, i) => `${k.auditId},${i % 3 === 0 ? 'no' : 'yes'},yes,"a, b"`)].join('\n'));
    expect(answers[0]?.note).toBe('a, b');
    const labels = new Map(key.map((k, i) => [k.key, i % 3 === 0 ? 'no' : 'yes']));
    const report = auditAgreement(key, answers, labels, new Map(key.map((k) => [k.key, 'correct'])));
    expect(report.gate.pass).toBe(true);
    expect(report.meaningful.n).toBe(30);
    expect(report.correctness?.observed).toBe(1);
    const disagree = auditAgreement(key, answers, new Map(key.map((k) => [k.key, 'yes'])));
    expect(disagree.gate.pass).toBe(false);
  });

  it('stratifies by rule and labeller label, and round-trips the [Answer] table', () => {
    const labelOf = new Map(items.map((it, i) => [it.key, i % 4 === 0 ? 'no' : 'yes']));
    labelOf.delete(items[1]?.key ?? '');
    const chosen = selectAuditStratified(items, 30, 7, labelOf);
    expect(chosen).toHaveLength(30);
    expect(chosen.some((c) => c.key === items[1]?.key)).toBe(false);
    for (const rule of ['FF-S01/dependency-direction', 'FF-P01/domain-purity']) {
      for (const label of ['yes', 'no']) expect(chosen.some((c) => c.rule === rule && labelOf.get(c.key) === label)).toBe(true);
    }
    expect(selectAuditStratified(items, 30, 7, labelOf).map((c) => c.key)).toEqual(chosen.map((c) => c.key));
    const sheet = auditTable(chosen, () => 'a | b');
    expect(sheet).not.toMatch(/FF-[A-Z]+\d/);
    expect(sheet).toContain('| ID | Style | Location | Finding | [Answer] |');
    expect(sheet).toContain('### A030');
    const filled = sheet.split('\n').map((l) => (l.startsWith('| A0') ? l.replace(/\|\s*\|$/, '| yes |') : l)).join('\n');
    const rows = parseAnswerTable(filled);
    expect(rows).toHaveLength(30);
    expect(rows.every((r) => r.meaningful === 'yes')).toBe(true);
    expect(parseAnswerTable(sheet).every((r) => r.meaningful === '')).toBe(true);
  });

  it("R29: correctness agreement maps only yes/no; other answers ('uncertain', 'n/a', 'y') are left out and reported", () => {
    const key = auditKey(selectAudit(items, 30, 5));
    // 25 'yes' (with case and whitespace variants), 5 other answers; the checker marks every item correct.
    const other = ['uncertain', 'n/a', 'y', 'unsure', 'maybe'];
    const answers = parseCsv(['auditId,meaningful,correct,note', ...key.map((k, i) => `${k.auditId},yes,${i < 25 ? (i % 2 === 0 ? ' YES ' : 'yes') : other[i - 25] ?? ''},`)].join('\n'));
    const report = auditAgreement(key, answers, new Map(key.map((k) => [k.key, 'yes'])), new Map(key.map((k) => [k.key, 'correct'])));
    expect(report.correctness?.n).toBe(25);
    expect(report.correctness?.observed).toBe(1);
    expect(report.correctnessUnmatched).toEqual(key.slice(25).map((k) => k.auditId));
    // 'no' (any case) still maps to incorrect.
    const withNo = parseCsv(['auditId,meaningful,correct,note', ...key.map((k, i) => `${k.auditId},yes,${i === 0 ? 'No' : 'yes'},`)].join('\n'));
    const r2 = auditAgreement(key, withNo, new Map(key.map((k) => [k.key, 'yes'])), new Map(key.map((k) => [k.key, 'correct'])));
    expect(r2.correctness?.n).toBe(30);
    expect(r2.correctness?.table).toEqual([[29, 0], [1, 0]]);
    expect(r2.correctnessUnmatched).toEqual([]);
  });
});
