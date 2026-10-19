/**
 * v1.4 U9 (C4-01 §4): the C4 contract with no project on disk. The `c4-v0.2` schema has no verdict field; an
 * exception claim must cite a doc or comment line that exists and holds the quote, else it becomes `claimed: false`
 * and counts as a hallucinated exception; two runs merge into stable fields; only stable claims go to C2; the
 * zero-call keyword baseline; every blocking finding (not only SEM) is a C4 input, and advisory rows are not.
 */
import { Ajv } from 'ajv';
import {
  INTERPRETATION_SCHEMA, blockingFindings, c3VerdictOf, checkExceptionCitation, commentPart, fromSemVerdict, fromViolation,
  groundC4Answer, keywordBaseline, mergeRuns, proposedExceptions, tierOf,
} from '../../../../src/apg-enrich/ontology/index.js';
import type { A5File, C4Answer, C4Finding, C4Run, ProjectDoc } from '../../../../src/apg-enrich/ontology/index.js';
import type { Violation } from '../../../../src/shared/taxonomy/violation-types.js';
import type { APGResult } from '../../../../src/shared/types/apg.js';
import type { EvaluationReport } from '../../../../src/shared/types/evaluation.js';

const DOCS: ProjectDoc[] = [
  { path: 'docs/adr/0004-read-side.md', adr: true, text: '# ADR-0004\n\nStatus: Accepted\n\n## Decision\nControllers may query read repositories directly.\n' },
  { path: 'README.md', adr: false, text: '# Orders\nStrict layering.\n' },
];
const FILES: Record<string, string> = {
  'src/web/order.controller.ts': "// ALLOWED: OrderController reads skip the service (ADR-0004).\nimport { OrderReadRepository } from '../infra/order-read.repository';\nexport class OrderController {}\n",
  'src/infra/order-read.repository.ts': 'export class OrderReadRepository {}\n',
};
const read = (p: string): string | null => FILES[p] ?? null;

function answer(over: Partial<C4Answer> = {}): C4Answer {
  return {
    explanation: 'x', intentMatch: { status: 'consistent-with-declared-intent', cites: ['docs/adr/0004-read-side.md:6'] },
    exceptionClaim: { claimed: true, citation: { path: 'docs/adr/0004-read-side.md', startLine: 6, endLine: 6, quote: 'Controllers may query  read repositories directly.' }, scope: 'the import' },
    severityClass: 'low', cites: ['src/web/order.controller.ts:2'], ...over,
  };
}

const APG: APGResult = {
  nodes: [
    { id: 'f1', type: 'File', filePath: 'src/web/order.controller.ts', name: 'order.controller.ts', decorators: [], properties: {} },
    { id: 'f2', type: 'File', filePath: 'src/infra/order-read.repository.ts', name: 'order-read.repository.ts', decorators: [], properties: {} },
    { id: 'c1', type: 'Class', filePath: 'src/web/order.controller.ts', name: 'OrderController', decorators: [], properties: {} },
    { id: 'c2', type: 'Class', filePath: 'src/infra/order-read.repository.ts', name: 'OrderReadRepository', decorators: [], properties: {} },
  ],
  edges: [],
} as unknown as APGResult;

const V = (functionId: string, over: Partial<Violation> = {}): Violation => ({
  id: `v-${functionId}`, type: 'LAYER_SKIP', dimension: 'structural', severity: 'critical', functionId, route: 'symbolic',
  filePath: 'src/web/order.controller.ts', message: `${functionId} message`, deterministic: true, line: 2, target: 'src/infra/order-read.repository.ts', ...over,
} as unknown as Violation);

const REPORT = {
  violations: [V('FF-S03'), V('FF-C03', { type: 'INSTABILITY_VIOLATION', target: undefined, line: undefined } as Partial<Violation>)],
  tiers: { blocking: { rules: [{ functionId: 'FF-S03', tier: 'blocking' }] } },
} as unknown as Pick<EvaluationReport, 'tiers' | 'violations'>;

describe('the c4-v0.2 schema (C4-01 §4.2 rule 1)', () => {
  const keys = (s: unknown): string[] => {
    if (typeof s !== 'object' || s === null) return [];
    const o = s as Record<string, unknown>;
    return [...Object.keys((o.properties as object | undefined) ?? {}), ...Object.values(o).flatMap(keys)];
  };
  it('has no verdict-shaped key anywhere and closes every object', () => {
    for (const k of ['pass', 'fail', 'violates', 'tier', 'verdict', 'assessment']) expect(keys(INTERPRETATION_SCHEMA)).not.toContain(k);
    const closed = (s: unknown): boolean => {
      if (typeof s !== 'object' || s === null) return true;
      const o = s as Record<string, unknown>;
      return (o.type !== 'object' || o.additionalProperties === false) && Object.values(o).every(closed);
    };
    expect(closed(INTERPRETATION_SCHEMA)).toBe(true);
  });

  it('accepts a full answer and a no-claim answer, and refuses an extra verdict key', () => {
    const v = new Ajv({ strict: false }).compile(INTERPRETATION_SCHEMA);
    expect(v(answer())).toBe(true);
    expect(v(answer({ exceptionClaim: { claimed: false, citation: null, scope: null } }))).toBe(true);
    expect(v({ ...answer(), verdict: 'pass' })).toBe(false);
    expect(v(answer({ severityClass: 'blocking' as never }))).toBe(false);
  });
});

describe('grounding an answer (C4-01 §4.2 rules 2 to 4)', () => {
  it('keeps a doc citation whose quote occurs in the cited lines (whitespace collapsed)', () => {
    const g = groundC4Answer(answer(), DOCS, read);
    expect(g.answer.exceptionClaim.claimed).toBe(true);
    expect(g.hallucinatedException).toBe(false);
    expect(g.rejections).toEqual([]);
  });

  it('keeps a comment-line citation in a source file, and rejects a code line as the grant', () => {
    expect(checkExceptionCitation({ path: 'src/web/order.controller.ts', startLine: 1, endLine: 1, quote: 'ALLOWED: OrderController reads skip the service' }, DOCS, read)).toBeNull();
    expect(checkExceptionCitation({ path: 'src/web/order.controller.ts', startLine: 2, endLine: 2, quote: 'OrderReadRepository' }, DOCS, read)).toMatchObject({ reason: 'citation-not-doc-or-comment' });
    expect(commentPart("import x from 'y'; // LEGACY: until 2027")).toBe('// LEGACY: until 2027');
    expect(commentPart('const a = 1;')).toBeNull();
  });

  it.each([
    ['no citation', { claimed: true, citation: null, scope: null }, 'exception-without-citation'],
    ['unknown path', { claimed: true, citation: { path: 'docs/nope.md', startLine: 1, endLine: 1, quote: 'x' }, scope: null }, 'citation-unknown-path'],
    ['lines out of range', { claimed: true, citation: { path: 'README.md', startLine: 2, endLine: 9, quote: 'x' }, scope: null }, 'citation-lines-out-of-range'],
    ['quote not in the lines', { claimed: true, citation: { path: 'README.md', startLine: 2, endLine: 2, quote: 'controllers may skip' }, scope: null }, 'citation-quote-mismatch'],
  ] as const)('a claim with %s becomes claimed: false and a hallucinated exception (never repaired)', (_n, claim, reason) => {
    const g = groundC4Answer(answer({ exceptionClaim: claim as C4Answer['exceptionClaim'] }), DOCS, read);
    expect(g.answer.exceptionClaim).toEqual({ claimed: false, citation: null, scope: null });
    expect(g.hallucinatedException).toBe(true);
    expect(g.rejections[0]?.reason).toBe(reason);
  });

  it('drops unresolved cites, and flags a claim that also contradicts the declared intent (falsifier 4)', () => {
    const g = groundC4Answer(answer({ cites: ['src/web/order.controller.ts:2', 'src/web/order.controller.ts:99', 'nowhere'], intentMatch: { status: 'contradicts-declared-intent', cites: [] } }), DOCS, read);
    expect(g.answer.cites).toEqual(['src/web/order.controller.ts:2']);
    expect(g.rejections.filter((r) => r.reason === 'cite-unresolved').map((r) => r.detail)).toEqual(['src/web/order.controller.ts:99', 'nowhere']);
    expect(g.inconsistent).toBe(true);
  });
});

describe('two runs (C4-01 §4.2 rule 6) and the proposals for C2 (§4.3)', () => {
  const run = (i: number, a: C4Answer | null): C4Run => ({ runIndex: i, grounded: a === null ? null : groundC4Answer(a, DOCS, read), modelId: a === null ? null : 'm', promptHash: 'h', date: a === null ? null : 'd', invalidReason: a === null ? 'budget' : null });
  const noClaim = answer({ exceptionClaim: { claimed: false, citation: null, scope: null }, intentMatch: { status: 'no-declared-intent', cites: [] }, severityClass: 'high' });

  it('a field is stable only when both runs agree', () => {
    const m = mergeRuns([run(0, answer()), run(1, answer())]);
    expect(m.exception).toMatchObject({ claimed: true, stability: 'agreed' });
    expect(m.intentMatch).toEqual({ status: 'consistent-with-declared-intent', stability: 'agreed' });
    expect(m.severityClass).toEqual({ value: 'low', stability: 'agreed' });
    const split = mergeRuns([run(0, answer()), run(1, noClaim)]);
    expect(split.exception).toMatchObject({ claimed: false, stability: 'single-run' });
    expect(split.intentMatch.stability).toBe('disagreed');
    expect(mergeRuns([run(0, answer()), run(1, null)]).exception).toMatchObject({ claimed: false });
    expect(mergeRuns([run(0, noClaim), run(1, noClaim)]).exception).toMatchObject({ claimed: false, stability: 'agreed' });
  });

  it('forwards only agreed, grounded claims to C2, with status proposed', () => {
    const f: C4Finding = fromViolation(V('FF-S03'), 'blocking', APG) as C4Finding;
    const entry = (runs: C4Run[]): A5File['entries'][number] => ({ findingId: f.id, finding: f, c3Verdict: c3VerdictOf(f), promptVersion: 'c4-v0.2', runs, merged: mergeRuns(runs) });
    const a5: A5File = {
      schemaVersion: 1, artifact: 'A5', project: { id: 'p' }, producer: { part: 'C4', promptVersion: 'c4-v0.2', provider: 'mock', model: 'm', runs: 2, exploratory: false },
      entries: [entry([run(0, answer()), run(1, answer())]), entry([run(0, answer()), run(1, noClaim)])],
    };
    const p = proposedExceptions(a5);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ rule: 'FF-S03', status: 'proposed', citation: { path: 'docs/adr/0004-read-side.md', startLine: 6 } });
  });
});

describe('C4 accepts every blocking finding, not only SEM verdicts (C4-01 §3 gap 1)', () => {
  it('maps a symbolic row to sites, files and edge, and copies the C3 verdict', () => {
    const f = fromViolation(V('FF-S03'), 'blocking', APG);
    expect(f).toMatchObject({ rule: 'FF-S03', origin: 'symbolic', tier: 'blocking', sites: ['c1'], files: ['src/web/order.controller.ts', 'src/infra/order-read.repository.ts'], edge: { file: 'src/web/order.controller.ts', line: 2, target: 'src/infra/order-read.repository.ts' }, facts: [], sem: null });
    expect(f?.id).toMatch(/^c4f:[0-9a-f]{16}$/);
    expect(fromViolation(V('FF-S03'), 'blocking', APG)?.id).toBe(f?.id);
    expect(c3VerdictOf(f as C4Finding)).toEqual({ rule: 'FF-S03', tier: 'blocking', verdict: 'fail' });
  });

  it('refuses an advisory row, and keeps the report\'s blocking rows plus every SEM verdict', () => {
    expect(fromViolation(V('FF-C03'), 'advisory', APG)).toBeNull();
    expect(tierOf(REPORT, 'FF-S03')).toBe('blocking');
    expect(tierOf(REPORT, 'FF-C03')).toBe('advisory');
    const sem = { rule: 'SEM-MISPLACED' as const, verdict: 'fail' as const, sites: ['c1'], context: null, facts: ['fact:1'], policy: 'agreed-only' as const };
    const all = blockingFindings(REPORT, APG, [sem]);
    expect(all.map((f) => [f.rule, f.origin])).toEqual([['FF-S03', 'symbolic'], ['SEM-MISPLACED', 'sem']]);
    expect(fromSemVerdict(sem, APG)).toMatchObject({ files: ['src/web/order.controller.ts'], facts: ['fact:1'], sem: { verified: null, policy: 'agreed-only' } });
  });
});

describe('the zero-call keyword baseline (C4-01 §6.2)', () => {
  const f = fromViolation(V('FF-S03'), 'blocking', APG) as C4Finding;
  it('claims when a doc or comment line names the site file or class and holds a keyword', () => {
    expect(keywordBaseline(f, ['OrderController', 'OrderReadRepository'], DOCS, read)).toEqual({ claimed: true, citation: { path: 'src/web/order.controller.ts', startLine: 1, endLine: 1, quote: '// ALLOWED: OrderController reads skip the service (ADR-0004).' } });
    const docs: ProjectDoc[] = [{ path: 'docs/map.md', adr: false, text: 'OrderReadRepository is not shared with the web layer.\n' }];
    expect(keywordBaseline(f, ['OrderReadRepository'], docs, () => '')).toMatchObject({ claimed: true, citation: { path: 'docs/map.md', startLine: 1 } });
  });

  it('does not claim on a keyword alone, nor on a name alone', () => {
    const docs: ProjectDoc[] = [{ path: 'a.md', adr: false, text: 'Exceptions are allowed.\nOrderController lists orders.\n' }];
    expect(keywordBaseline(f, ['OrderController'], docs, () => '')).toEqual({ claimed: false, citation: null });
  });
});
