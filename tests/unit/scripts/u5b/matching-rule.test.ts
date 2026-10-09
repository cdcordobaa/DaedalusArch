/**
 * U5b Step 6: matching-rule loader and root-cause list (BR-U5b-01, 28, 30).
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  DRAFT_RULE_VERSION,
  MATCHING_RULE_DOC,
  ROOT_CAUSE_CODES,
  RULE_ORDER,
  SCORE_RULE_MISMATCH,
  documentRootCauseTable,
  loadMatchingRule,
  machineBlockText,
  parseMatchingRule,
  registeredRuleVersion,
} from '../../../../scripts/lib/matching-rule.js';
import type { RootCauseCode } from '../../../../scripts/lib/matching-rule.js';

const ROOT = resolve(__dirname, '../../../..');
const DOC = readFileSync(join(ROOT, MATCHING_RULE_DOC), 'utf8');

describe('Docs/matching-rule.md machine block (BR-U5b-01)', () => {
  it('loads from the repository with the draft version and the fixed constants', () => {
    const r = loadMatchingRule(ROOT);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rule.version).toBe(registeredRuleVersion(ROOT));
    expect(r.rule.lineTolerance).toBe(0);
    expect(r.rule.multiDetection).toBe('count-once');
    expect(r.rule.collateralSource).toBe('manifest');
    expect(r.rule.fpModes).toEqual(['strict', 'labelled']);
    expect(r.rule.ruleOrder).toEqual([...RULE_ORDER]);
    // Step 2 readiness flags: project-level keys and row filters both landed → nothing excluded (BR-U5b-16).
    expect(r.rule.metricKeyExclusions).toEqual([]);
    expect(r.rule.rootCauses).toEqual([...ROOT_CAUSE_CODES]);
  });

  it('a document without the machine block yields SCORE_RULE_MISMATCH and no rule', () => {
    const without = DOC.replace(/```yaml matching-rule[\s\S]*?\n```\n/, '');
    expect(machineBlockText(without)).toBeUndefined();
    const r = parseMatchingRule(without, DRAFT_RULE_VERSION);
    expect(r).toEqual({ ok: false, code: SCORE_RULE_MISMATCH, detail: expect.stringContaining('machine block') as unknown });
  });

  it('a version different from the registered one is refused', () => {
    const r = parseMatchingRule(DOC, '1.1.1');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe(SCORE_RULE_MISMATCH);
    expect(r.detail).toContain('1.1.0 != registered 1.1.1');
    // The 1.0.0 label of prereg v1 / v2 no longer loads the 1.1.0 document (ADR-020 items 2, 5, 8).
    expect(parseMatchingRule(DOC, DRAFT_RULE_VERSION).ok).toBe(false);
  });

  it('the status header names the machine-block version (ADR-020; no 1.1.0 semantics under a 1.0.0 label)', () => {
    const header = DOC.split('\n---\n')[0] ?? '';
    const named = [...header.matchAll(/version `(\d+\.\d+\.\d+)`/g)].map((m) => m[1]);
    const r = parseMatchingRule(DOC, registeredRuleVersion(ROOT));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(named[named.length - 1]).toBe(r.rule.version);
    expect(r.rule.version).toBe('1.1.0');
  });

  it('a changed constant in the block is refused', () => {
    expect(parseMatchingRule(DOC.replace('lineTolerance: 0', 'lineTolerance: 1'), registeredRuleVersion(ROOT)).ok).toBe(false);
    expect(parseMatchingRule(DOC.replace('multiDetection: count-once', 'multiDetection: count-all'), registeredRuleVersion(ROOT)).ok).toBe(false);
    expect(parseMatchingRule(DOC.replace('  - twin\n  - detection', '  - detection\n  - twin'), registeredRuleVersion(ROOT)).ok).toBe(false);
    expect(parseMatchingRule(DOC.replace('  - RC-OTHER\n```', '```'), registeredRuleVersion(ROOT)).ok).toBe(false);
  });

  it('the registered version comes from corpus/prereg.json when it exists; missing doc is refused', () => {
    const dir = mkdtempSync(join(tmpdir(), 'u5b-rule-'));
    try {
      expect(loadMatchingRule(dir).ok).toBe(false);
      mkdirSync(join(dir, 'Docs'));
      mkdirSync(join(dir, 'corpus'));
      writeFileSync(join(dir, MATCHING_RULE_DOC), DOC);
      expect(registeredRuleVersion(dir)).toBe(DRAFT_RULE_VERSION);
      writeFileSync(join(dir, 'corpus/prereg.json'), JSON.stringify({ version: 1, matchingRuleVersion: '2.0.0' }));
      expect(registeredRuleVersion(dir)).toBe('2.0.0');
      const r = loadMatchingRule(dir);
      expect(r.ok ? 'loaded' : r.code).toBe(SCORE_RULE_MISMATCH);
      writeFileSync(join(dir, 'corpus/prereg.json'), JSON.stringify({ version: 1 }));
      expect(loadMatchingRule(dir).ok).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('root-cause list (BR-U5b-28, 30)', () => {
  it('the RootCauseCode union, the machine block and the document table are equal (12 codes)', () => {
    const union: readonly RootCauseCode[] = ROOT_CAUSE_CODES;
    expect(new Set(union).size).toBe(12);
    const r = loadMatchingRule(ROOT);
    expect(r.ok && new Set(r.rule.rootCauses)).toEqual(new Set(union));
    expect(new Set(documentRootCauseTable(DOC))).toEqual(new Set(union));
    expect(documentRootCauseTable(DOC)).toHaveLength(12);
  });

  it('instrument codes are all RC-* (disjoint from the SO5 FPAT-* / GEN-* namespaces)', () => {
    for (const code of ROOT_CAUSE_CODES) expect(code).toMatch(/^RC-[A-Z-]+$/);
  });
});
