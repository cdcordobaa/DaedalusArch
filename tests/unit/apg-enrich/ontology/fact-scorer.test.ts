/** v1.4 U3 D7: the fact and verdict scorer over a manifest's `ns02` block (synthetic A1 and A2). */
import { FactScoreError, factId, resolveSubject, scoreFacts, scoreVerdicts } from '../../../../src/apg-enrich/ontology/index.js';
import type { Fact, FactsFile, Ns02Block, SemVerdict } from '../../../../src/apg-enrich/ontology/index.js';
import type { APGNode, APGResult } from '../../../../src/shared/types/apg.js';

const node = (id: string, type: string, name: string): APGNode => ({ id, type: type as APGNode['type'], filePath: 'f.ts', name, decorators: [], properties: {} });
const APG = {
  nodes: [node('c1', 'Class', 'OrderController'), node('m1', 'Method', 'OrderController.create'), node('c2', 'Class', 'Order'), node('m2', 'Method', 'Order.create'), node('d1', 'Class', 'Dup'), node('d2', 'Class', 'Dup')],
  edges: [],
} as unknown as APGResult;
const EV = [{ nodeId: 'm1', file: 'f.ts', startLine: 1, endLine: 1, quote: 'q', grounded: true as const }];

function fact(subject: string, predicate: Fact['predicate'], value: unknown, source: 'parser' | 'model', agreement: 'agreed' | 'single-run' = 'agreed'): Fact {
  const base = source === 'parser'
    ? { subject, predicate, value: value as Fact['value'], source, basis: 'apg' as const, modelId: null, promptHash: null, date: 'd', confidence: null, agreement: null, runIndex: null, evidence: [] }
    : { subject, predicate, value: value as Fact['value'], source, basis: null, modelId: 'm', promptHash: 'h', date: 'd', confidence: 0.9, agreement, runIndex: agreement === 'agreed' ? null : 0, evidence: EV };
  return { id: factId(base), ...base };
}
const file = (facts: Fact[]): FactsFile => ({
  schemaVersion: 1, artifact: 'A2', project: { id: 'p', contentHash: 'h', commit: null }, inputs: { a1: { apgHash: 'h' }, layerModel: { path: null, hash: null } },
  producer: { part: 'C1d', pipeline: 'ontology-v0', promptVersion: 'ontology-v0.2', provider: 'mock', model: 'm', runs: 2, runId: 'r', factPolicy: 'agreed-only' }, facts,
});

describe('resolveSubject', () => {
  it('resolves Class and Class.method names; a missing or ambiguous name is an error', () => {
    expect(resolveSubject('OrderController', APG)).toBe('c1');
    expect(resolveSubject('OrderController.create', APG)).toBe('m1');
    expect(() => resolveSubject('Nope', APG)).toThrow(FactScoreError);
    expect(() => resolveSubject('Dup', APG)).toThrow(/ambiguous/);
  });
});

describe('scoreFacts', () => {
  const facts = file([
    fact('c1', 'inLayer', 'presentation', 'parser'),
    fact('c1', 'inContext', { context: 'ordering', declared: true }, 'parser'),
    fact('m1', 'enforcesRule', { statement: 's', subject: 'quantity', operator: '<=', threshold: 20, unit: 'units', kind: 'business', ruleId: 'sem:r' }, 'model'),
    fact('c1', 'hasResponsibility', { name: 'n', description: 'd', naturalLayer: 'Domain' }, 'model', 'single-run'),
    fact('m2', 'sameRuleAs', { other: 'm1', same: true }, 'model'),
  ]);
  const block: Ns02Block = {
    expectedFacts: [
      { subject: 'OrderController', predicate: 'inLayer', value: 'presentation', source: 'parser', polarity: 'required' },
      { subject: 'OrderController', predicate: 'inContext', value: 'ordering', polarity: 'required' },
      { subject: 'OrderController.create', predicate: 'enforcesRule', value: { kind: 'business', threshold: 20 }, source: 'model', polarity: 'required' },
      { subject: 'OrderController', predicate: 'hasResponsibility', value: { naturalLayer: 'domain' }, polarity: 'required' },
      { subject: 'Order.create', predicate: 'enforcesRule', value: { kind: 'business' }, polarity: 'forbidden' },
      { subject: 'OrderController.create', predicate: 'enforcesRule', value: { kind: 'input-validation' }, polarity: 'tolerated' },
      { subject: 'OrderController.create', predicate: 'sameRuleAs', value: { other: 'Order.create', same: true }, polarity: 'required' },
    ],
    expectedVerdicts: [],
  };

  it('scores required, forbidden and tolerated facts by subset match; under agreed-only a single-run fact does not count', () => {
    const s = scoreFacts(block, facts, APG, 'agreed-only');
    expect(s.items.map((i) => i.outcome)).toEqual(['hit', 'hit', 'hit', 'missed', 'clear', 'absent', 'hit']);
    expect(s).toMatchObject({ required: 5, hit: 4, forbidden: 1, falseFacts: 0, policy: 'agreed-only' });
  });

  it('under any, the single-run fact counts (strings compare case-insensitively); a forbidden fact is a false fact', () => {
    const s = scoreFacts(block, file([...facts.facts, fact('m2', 'enforcesRule', { statement: 's', subject: 'q', operator: '<=', threshold: 20, unit: null, kind: 'business', ruleId: null }, 'model')]), APG, 'any');
    expect(s.items.map((i) => i.outcome)).toEqual(['hit', 'hit', 'hit', 'hit', 'false-fact', 'absent', 'hit']);
    expect(s.falseFacts).toBe(1);
  });
});

describe('scoreVerdicts', () => {
  const v = (rule: SemVerdict['rule'], sites: string[], verified?: boolean): SemVerdict => ({ rule, verdict: 'fail', sites, context: null, facts: [], policy: 'agreed-only', ...(verified !== undefined ? { verified } : {}) });

  it('no row means pass; SEM-MISPLACED Class.method is matched at the owning class; SEM-DUP checks verified when stated', () => {
    const block: Ns02Block = {
      expectedFacts: [],
      expectedVerdicts: [
        { rule: 'SEM-MISPLACED', verdict: 'fail', sites: ['OrderController.create'] },
        { rule: 'SEM-FRAG', verdict: 'pass' },
        { rule: 'SEM-DUP', verdict: 'fail', sites: ['OrderController.create', 'Order.create'], verified: true },
      ],
    };
    expect(scoreVerdicts(block, [v('SEM-MISPLACED', ['c1']), v('SEM-DUP', ['m1', 'm2'], true)], APG).map((s) => s.outcome)).toEqual(['found', 'clear', 'found']);
    expect(scoreVerdicts(block, [v('SEM-FRAG', ['c1', 'c2']), v('SEM-DUP', ['m1', 'm2'], false)], APG).map((s) => s.outcome)).toEqual(['missed', 'false-verdict', 'missed']);
  });
});
