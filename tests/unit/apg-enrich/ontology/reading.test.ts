/**
 * v1.4 U3 amendment A1 (`aidlc-docs/construction/v1.4/U3/amendments/A1-graph-complements-reading.md`): the graph
 * complements reading. Mock model only (scripted answers and the committed mock cassettes); no provider is called.
 *
 * - every prompt the mock model receives carries the code and the graph slice, and the docs where they exist;
 * - every A2 fact cites a code or doc location (plus graph statistics where they apply), and a fact without a
 *   citation is rejected when it is written;
 * - C4 interpretation gets the docs, the ADRs and the comments near the finding.
 */
import {
  A2InvariantError, FACT_GRAPH_QUERIES, MockOntologyProvider, buildFacts, buildInterpretationContext, collectProjectDocs,
  createScriptedResponder, diskReader, docExcerpts, interpretationPrompt, isAdrPath, loadFacts, runOntology, runSemRules,
  validateFacts, writeFact,
} from '../../../../src/apg-enrich/ontology/index.js';
import type { Fact, FactsFile, OntologyInput, OntologyModelRequest, OntologyRunDetail, ScriptedAnswers } from '../../../../src/apg-enrich/ontology/index.js';
import { MemoryGraphRepository } from '../../../../src/cypher-interp/index.js';
import { LAYERS, fixtureInput, mockAnswers, nodeId, projectInput, replayDetail } from './helpers.js';

const NOW = (): string => '2026-10-19T00:00:00.000Z';

/** A small project with a README, an ADR and a commented class; one rule site and one misplaced responsibility. */
const DOCUMENTED: Record<string, string> = {
  'README.md': '# Shop\n\nThe PricingService applies the loyalty discount.\nOther text.\n',
  'docs/adr/0001-pricing-in-application.md': '# ADR 1: pricing stays in the application layer\n\nStatus: accepted.\n\nPricingService keeps the discount rule on purpose until the domain model exists.\n',
  'src/orders/application/pricing.service.ts': [
    'import { OrderRepository } from "../infrastructure/order.repository";',
    '',
    '/** Applies the loyalty discount (see ADR 1). */',
    'export class PricingService {',
    '  constructor(private readonly repo: OrderRepository) {}',
    '  // The discount threshold is a business rule.',
    '  price(total: number): number {',
    '    if (total >= 100) {',
    '      return total * 0.9;',
    '    }',
    '    return total;',
    '  }',
    '}',
    '',
  ].join('\n'),
  'src/orders/infrastructure/order.repository.ts': 'export class OrderRepository {\n  save(id: string): string {\n    return id;\n  }\n}\n',
};

const SCRIPT: ScriptedAnswers = {
  case: 'a1-documented',
  responses: [
    {
      pass: 'responsibility', item: 'PricingService',
      answer: {
        responsibilities: [{ name: 'Loyalty discount', description: 'applies the discount', naturalLayer: 'domain', confidence: 0.9, evidence: [{ node: 'PricingService.price', quote: 'if (total >= 100) {' }] }],
        concepts: [{ name: 'Order price', relation: 'uses', confidence: 0.8, evidence: [{ node: 'PricingService.price', quote: 'return total * 0.9;' }] }],
      },
    },
    {
      pass: 'rules', item: 'PricingService',
      answer: { rules: [{ statement: 'orders of 100 or more get 10% off', kind: 'business', subject: 'order total', operator: '>=', threshold: 100, unit: 'currency', enforcedBy: 'PricingService.price', confidence: 0.9, evidence: [{ node: 'PricingService.price', quote: 'if (total >= 100) {' }] }] },
    },
  ],
};

async function documentedRun(): Promise<{ input: OntologyInput; detail: OntologyRunDetail; requests: readonly OntologyModelRequest[]; cleanup: () => void }> {
  const { input, cleanup } = await projectInput(DOCUMENTED);
  const mock = new MockOntologyProvider(createScriptedResponder(SCRIPT, input.apg, diskReader(input.projectRoot)));
  const detail = await runOntology(input, { provider: mock, cacheMode: 'off', cacheDir: null, ruleMinDensity: 1, now: NOW });
  return { input, detail, requests: mock.received(), cleanup };
}

describe('A1: project documentation', () => {
  it('collects README, docs and ADRs, repo-relative and sorted; ADRs are recognised by folder or name', async () => {
    const { input, cleanup } = await projectInput(DOCUMENTED);
    try {
      expect(input.docs?.map((d) => [d.path, d.adr])).toEqual([['docs/adr/0001-pricing-in-application.md', true], ['README.md', false]]);
      expect(collectProjectDocs(input.projectRoot).map((d) => d.path)).toEqual(input.docs?.map((d) => d.path));
    } finally {
      cleanup();
    }
    expect(isAdrPath('docs/decisions/use-postgres.md')).toBe(true);
    expect(isAdrPath('ADR-007-cache.md')).toBe(true);
    expect(isAdrPath('docs/guide.md')).toBe(false);
  }, 60_000);

  it('excerpts only the lines that mention a term, ADRs first, line-numbered', () => {
    const docs = [{ path: 'README.md', text: 'a\nPricingService here\nb', adr: false }, { path: 'adr/1.md', text: 'x\ny\nPricingService too', adr: true }];
    const ex = docExcerpts(docs, ['PricingService']);
    expect(ex.map((e) => [e.path, e.startLine, e.endLine])).toEqual([['adr/1.md', 1, 3], ['README.md', 1, 3]]);
    expect(ex[1]?.numbered).toContain('2| PricingService here');
    expect(docExcerpts(docs, ['Nothing'])).toEqual([]);
  });
});

describe('A1: the prompt builder supplies the code and the graph, plus the docs (mock model)', () => {
  let run: Awaited<ReturnType<typeof documentedRun>>;
  beforeAll(async () => { run = await documentedRun(); }, 120_000);
  afterAll(() => { run.cleanup(); });

  it('every prompt of passes (a) and (c) has the source, the graph slice with its statistics, the comments and the docs', () => {
    const ac = run.requests.filter((r) => (r.pass === 'responsibility' || r.pass === 'rules') && r.itemName === 'PricingService');
    expect(new Set(ac.map((r) => r.pass))).toEqual(new Set(['responsibility', 'rules']));
    for (const r of ac) {
      expect(r.prompt).toContain('=====SOURCE-BEGIN src/orders/application/pricing.service.ts');
      expect(r.prompt).toContain('if (total >= 100) {');
      expect(r.prompt).toContain('## APG neighbourhood');
      expect(r.prompt).toMatch(/Graph statistics: \d+ methods; fan-out [1-9]/);
      expect(r.prompt).toContain('CONSTRUCTOR_INJECTS Class OrderRepository');
      expect(r.prompt).toContain('## Comments near the code');
      expect(r.prompt).toContain('Applies the loyalty discount (see ADR 1).');
      expect(r.prompt).toContain('=====DOC-BEGIN docs/adr/0001-pricing-in-application.md');
      expect(r.prompt).toContain('(ADR)');
      expect(r.prompt).toContain('=====DOC-BEGIN README.md');
    }
  });

  it('the pass (b) prompt has the classes\' declaration code and the group\'s graph relations', () => {
    const b = run.requests.filter((r) => r.pass === 'capability');
    expect(b.length).toBeGreaterThan(0);
    for (const r of b) {
      expect(r.prompt).toMatch(/declaration line \d+: "export class/);
      expect(r.prompt).toContain('## APG relations of the group');
      expect(r.prompt).toMatch(/Graph statistics: \d+ classes;/);
    }
  });

  it('the system prompt keeps the docs as data and says the graph complements reading', () => {
    const sys = run.requests[0]?.system ?? '';
    expect(sys).toContain('DOC-BEGIN and DOC-END markers');
    expect(sys).toContain('the graph complements reading the code, it does not replace it');
  });

  it('a project without docs gets no docs section, but still the code and the graph', async () => {
    const input = await fixtureInput('case-02-misplaced-pricing');
    expect(input.docs).toEqual([]);
    const mock = new MockOntologyProvider(createScriptedResponder(mockAnswers('case-02-misplaced-pricing'), input.apg, diskReader(input.projectRoot)));
    await runOntology(input, { provider: mock, cacheMode: 'off', cacheDir: null, runs: 1, now: NOW });
    const reqs = mock.received();
    expect(reqs.length).toBeGreaterThan(0);
    for (const r of reqs) expect(r.prompt).not.toContain('=====DOC-BEGIN');
    for (const r of reqs.filter((x) => x.pass === 'responsibility' || x.pass === 'rules')) {
      expect(r.prompt).toContain('=====SOURCE-BEGIN');
      expect(r.prompt).toContain('Graph statistics:');
    }
    for (const r of reqs.filter((x) => x.pass === 'adjudicate')) {
      expect(r.prompt).toContain('=====SOURCE-BEGIN');
      expect(r.prompt).toMatch(/graph:\n- class \S+ \(node /);
    }
  }, 120_000);

  it('adjudication prompts carry the code and the graph slice of both sides', async () => {
    const c = 'case-01-rule-dup-shapes';
    const input = await fixtureInput(c);
    const mock = new MockOntologyProvider(createScriptedResponder(mockAnswers(c), input.apg, diskReader(input.projectRoot)));
    await runOntology(input, { provider: mock, cacheMode: 'off', cacheDir: null, now: NOW });
    const d = mock.received().filter((r) => r.pass === 'adjudicate');
    expect(d.length).toBeGreaterThan(0);
    for (const r of d) {
      expect(r.prompt.match(/=====SOURCE-BEGIN/g)).toHaveLength(2);
      expect(r.prompt.match(/\ngraph:\n- (class|component|community) /g)).toHaveLength(2);
    }
  }, 120_000);
});

describe('A1: every A2 fact cites where it was read', () => {
  let input02: OntologyInput;
  let a2: FactsFile;
  beforeAll(async () => {
    input02 = await fixtureInput('case-02-misplaced-pricing');
    a2 = buildFacts(await replayDetail(input02, 'case-02-misplaced-pricing'), input02, { projectId: 'case-02-misplaced-pricing', layerModelPath: null });
  }, 120_000);

  it('each fact cites at least one code or doc location; class facts also cite their graph statistics and queries', () => {
    expect(a2.facts.length).toBeGreaterThan(0);
    for (const f of a2.facts) {
      expect(f.citations.locations.length).toBeGreaterThan(0);
      for (const l of f.citations.locations) expect(l.startLine).toBeGreaterThanOrEqual(1);
    }
    const cls = nodeId(input02, 'Class', 'OrderNotificationService');
    const resp = a2.facts.find((f) => f.subject === cls && f.predicate === 'hasResponsibility');
    expect(resp?.citations.graph.map((g) => g.statistic)).toEqual(['fanOut', 'fanIn']);
    expect(resp?.citations.graph[0]?.query).toBe(FACT_GRAPH_QUERIES.fanOut);
    expect(resp?.citations.locations.every((l) => l.kind === 'code' && l.file === 'src/notifications/application/order-notification.service.ts')).toBe(true);
    const layer = a2.facts.find((f) => f.subject === cls && f.predicate === 'inLayer');
    expect(layer?.citations).toMatchObject({ locations: [{ kind: 'code', file: 'src/notifications/application/order-notification.service.ts' }], graph: [{ statistic: 'layerKind', value: 'application' }] });
    const rule = a2.facts.find((f) => f.predicate === 'enforcesRule');
    if (rule !== undefined) expect(rule.citations.graph.map((g) => g.statistic)).toContain('callers');
  });

  it('a mock-model fact with no citation is rejected when it is written, not at scoring', () => {
    const model = a2.facts.find((f) => f.source === 'model');
    if (model === undefined) throw new Error('no model fact');
    const { id: _id, ...rest } = model;
    const store = new Map<string, Fact>();
    expect(() => writeFact(store, { ...rest, citations: { locations: [], graph: rest.citations.graph } })).toThrow(A2InvariantError);
    expect(() => writeFact(store, { ...rest, citations: { locations: [], graph: rest.citations.graph } })).toThrow(/I6 .*without a code or doc citation/);
    expect(store.size).toBe(0);
    // A graph statistic alone is not a citation: the graph complements the reading, it does not replace it.
    expect(() => writeFact(store, { ...rest, citations: { locations: [{ kind: 'code', file: '', startLine: 0, endLine: 0 }], graph: [{ statistic: 'fanOut', value: 1, query: FACT_GRAPH_QUERIES.fanOut }] } })).toThrow(A2InvariantError);
    expect(writeFact(store, rest).id).toBe(model.id);
    expect(store.size).toBe(1);
  });

  it('validateFacts reports an uncited fact as I6', () => {
    const bad = a2.facts.map((f, i) => (i === 0 ? { ...f, citations: { locations: [], graph: [] } } : f));
    try {
      validateFacts({ ...a2, facts: bad }, input02.apg);
      throw new Error('accepted');
    } catch (e) {
      expect(e).toBeInstanceOf(A2InvariantError);
      expect((e as A2InvariantError).violations.some((v) => v.startsWith('I6'))).toBe(true);
    }
  });

  it('a model fact read beside the docs also cites the doc lines, and its rule fact cites the callers query', async () => {
    const run = await documentedRun();
    try {
      const facts = buildFacts(run.detail, run.input, { projectId: 'a1-documented', layerModelPath: null });
      const cls = nodeId(run.input, 'Class', 'PricingService');
      const resp = facts.facts.find((f) => f.subject === cls && f.predicate === 'hasResponsibility');
      expect(resp?.citations.locations.filter((l) => l.kind === 'doc').map((l) => l.file)).toEqual(['docs/adr/0001-pricing-in-application.md', 'README.md']);
      expect(resp?.citations.locations.some((l) => l.kind === 'code')).toBe(true);
      expect(resp?.citations.graph.find((g) => g.statistic === 'fanOut')?.value).toBeGreaterThanOrEqual(1);
      const rule = facts.facts.find((f) => f.predicate === 'enforcesRule');
      expect(rule?.citations.graph.map((g) => g.statistic)).toEqual(['callers', 'fanOut', 'fanIn']);
    } finally {
      run.cleanup();
    }
  }, 120_000);
});

describe('A1: C4 interpretation gets the docs, the ADRs and the comments near the finding', () => {
  it('builds the context of a SEM-MISPLACED verdict and renders it with code, graph, comments, docs and ADRs', async () => {
    const run = await documentedRun();
    try {
      const facts = buildFacts(run.detail, run.input, { projectId: 'a1-documented', layerModelPath: null });
      const repo = new MemoryGraphRepository();
      const loaded = await loadFacts(run.input.apg, LAYERS, facts, repo);
      if (!loaded.success) throw new Error('load');
      const v = await runSemRules(repo, facts, 'agreed-only');
      if (!v.success) throw new Error('rules');
      const mis = v.data.find((x) => x.rule === 'SEM-MISPLACED');
      if (mis === undefined) throw new Error('no SEM-MISPLACED verdict');
      const ctx = buildInterpretationContext(mis, facts, run.detail.units, diskReader(run.input.projectRoot));
      expect(ctx.facts.map((f) => f.id)).toEqual(mis.facts);
      // v1.4 U9: an ADR excerpt below the head brings the head (title, status) first.
      expect(ctx.docs.map((d) => [d.path, d.adr])).toEqual([['docs/adr/0001-pricing-in-application.md', true], ['docs/adr/0001-pricing-in-application.md', true], ['README.md', false]]);
      expect(ctx.docs[0]?.startLine).toBe(1);
      expect(ctx.comments.map((c) => c.text)).toEqual(expect.arrayContaining(['/** Applies the loyalty discount (see ADR 1). */', '// The discount threshold is a business rule.']));
      const prompt = interpretationPrompt(ctx);
      for (const part of ['## Facts (A2)', '## Graph slice', 'fan-out', '## Comment lines near the finding', '=====DOC-BEGIN docs/adr/0001-pricing-in-application.md', '(ADR)', 'keeps the discount rule on purpose', '=====SOURCE-BEGIN src/orders/application/pricing.service.ts', 'declared exception']) {
        expect(prompt).toContain(part);
      }
    } finally {
      run.cleanup();
    }
  }, 120_000);

  it('includes the ADR heads when no ADR names the finding\'s code', async () => {
    const run = await documentedRun();
    try {
      const facts = buildFacts(run.detail, run.input, { projectId: 'a1-documented', layerModelPath: null });
      const units = { ...run.detail.units, docs: [{ path: 'docs/adr/0002-logging.md', text: '# ADR 2: logging\nStatus: accepted.\n', adr: true }] };
      const verdict = { rule: 'SEM-MISPLACED' as const, verdict: 'fail' as const, sites: [nodeId(run.input, 'Class', 'PricingService')], context: null, facts: [], policy: 'agreed-only' as const };
      const ctx = buildInterpretationContext(verdict, facts, units, diskReader(run.input.projectRoot));
      expect(ctx.docs.map((d) => d.path)).toEqual(['docs/adr/0002-logging.md']);
      expect(interpretationPrompt(ctx)).toContain('# ADR 2: logging');
    } finally {
      run.cleanup();
    }
  }, 120_000);
});
