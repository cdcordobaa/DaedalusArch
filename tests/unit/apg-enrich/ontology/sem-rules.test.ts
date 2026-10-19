/**
 * v1.4 U3 D2: the three Sem rules (Cypher over A1 + A2 on the in-process interpreter; no Neo4j).
 * Parity with the pipeline's findings on the six parent mock replays, SEM-FRAG under N4, the fact policy, the
 * ablation (A1 alone gives no verdict) and input checks (never a SEM-DUP).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEM_RULES, buildFacts, factId, loadFacts, prepareOntologyInput, runSemRules } from '../../../../src/apg-enrich/ontology/index.js';
import type { Fact, FactPolicy, FactsFile, OntologyInput, OntologyResult, SemVerdict } from '../../../../src/apg-enrich/ontology/index.js';
import { MemoryGraphRepository, parseCypher } from '../../../../src/cypher-interp/index.js';
import type { LayerModel } from '../../../../src/shared/types/spec.js';
import { CASES, FIXTURES, LAYERS, fixtureInput, nodeId, replayDetail } from './helpers.js';

const EV = [{ nodeId: 'n', file: 'f.ts', startLine: 1, endLine: 1, quote: 'q', grounded: true as const }];
// Amendment A1 (I6): every fact cites a code or doc location.
const CITED = { locations: [{ kind: 'code' as const, file: 'f.ts', startLine: 1, endLine: 1 }], graph: [] };

function fact(subject: string, predicate: Fact['predicate'], value: unknown, source: 'parser' | 'model', agreement: 'agreed' | 'single-run' = 'agreed'): Fact {
  const base = source === 'parser'
    ? { subject, predicate, value: value as Fact['value'], source, basis: 'apg' as const, modelId: null, promptHash: null, date: 'd', confidence: null, agreement: null, runIndex: null, evidence: [], citations: CITED }
    : { subject, predicate, value: value as Fact['value'], source, basis: null, modelId: 'm', promptHash: 'h', date: 'd', confidence: 0.9, agreement, runIndex: agreement === 'agreed' ? null : 0, evidence: EV, citations: CITED };
  return { id: factId(base), ...base };
}

function file(facts: readonly Fact[], factPolicy: FactPolicy = 'agreed-only'): FactsFile {
  return {
    schemaVersion: 1, artifact: 'A2', project: { id: 'synthetic', contentHash: 'h', commit: null },
    inputs: { a1: { apgHash: 'h' }, layerModel: { path: null, hash: null } },
    producer: { part: 'C1d', pipeline: 'ontology-v0', promptVersion: 'ontology-v0.3', provider: 'mock', model: 'mock-ontology', runs: 2, runId: 'r', factPolicy },
    facts,
  };
}

async function verdicts(input: OntologyInput, layers: LayerModel | undefined, a2: FactsFile, policy: FactPolicy = a2.producer.factPolicy): Promise<SemVerdict[]> {
  const repo = new MemoryGraphRepository();
  const l = await loadFacts(input.apg, layers, a2, repo);
  if (!l.success) throw new Error(l.errors.map((e) => e.message).join('; '));
  const v = await runSemRules(repo, a2, policy);
  if (!v.success) throw new Error(v.errors.map((e) => e.message).join('; '));
  return v.data;
}

describe('Sem rules', () => {
  it('every rule parses on the in-process interpreter', () => {
    for (const q of Object.values(SEM_RULES)) expect(() => parseCypher(q)).not.toThrow();
  });

  describe('parity with the pipeline on the six parent mock replays', () => {
    const prepared = new Map<string, { input: OntologyInput; result: OntologyResult; verdicts: SemVerdict[] }>();
    beforeAll(async () => {
      for (const c of CASES) {
        const input = await fixtureInput(c);
        const detail = await replayDetail(input, c);
        const a2 = buildFacts(detail, input, { projectId: c, layerModelPath: null });
        prepared.set(c, { input, result: detail.result, verdicts: await verdicts(input, LAYERS, a2) });
      }
    }, 240_000);

    it('SEM-MISPLACED equals the misplaced-responsibility findings at the owning class', () => {
      for (const [c, p] of prepared) {
        const classOf = (file: string, cls: string): string => p.input.apg.nodes.find((n) => n.type === 'Class' && n.filePath === file && n.name === cls)?.id ?? `missing ${cls}`;
        const want = p.result.findings.flatMap((f) => (f.kind === 'misplaced-responsibility' ? [classOf(f.site.file, f.site.className)] : [])).sort();
        const got = p.verdicts.filter((v) => v.rule === 'SEM-MISPLACED').flatMap((v) => v.sites).sort();
        expect({ c, got }).toEqual({ c, got: want });
      }
      expect(prepared.get('case-02-misplaced-pricing')?.verdicts.filter((v) => v.rule === 'SEM-MISPLACED')).toHaveLength(1);
    });

    it('SEM-DUP equals the semantic-rule-duplication findings site for site, verified included', () => {
      for (const [c, p] of prepared) {
        const want = p.result.findings.flatMap((f) => (f.kind === 'semantic-rule-duplication' ? [{ sites: f.sites.map((s) => s.nodeId).sort(), verified: f.verification.verified }] : []));
        const got = p.verdicts.filter((v) => v.rule === 'SEM-DUP').map((v) => ({ sites: [...v.sites].sort(), verified: v.verified }));
        expect({ c, got }).toEqual({ c, got: want });
      }
      expect(prepared.get('case-01-rule-dup-shapes')?.verdicts.find((v) => v.rule === 'SEM-DUP')).toMatchObject({ verified: true });
    });

    it('SEM-FRAG gives no row on case-03 (no declared context, N4) nor on any parent case', () => {
      for (const p of prepared.values()) expect(p.verdicts.filter((v) => v.rule === 'SEM-FRAG')).toEqual([]);
    });

    it('ablation: A1 with an empty A2 gives zero verdicts', async () => {
      for (const p of prepared.values()) expect(await verdicts(p.input, LAYERS, file([]))).toEqual([]);
    });
  });

  describe('synthetic A2 (case-05 classes)', () => {
    const dir = join(FIXTURES, 'ns02', 'case-05-fragmentation-in-context');
    const layers = JSON.parse(readFileSync(join(dir, 'layers.json'), 'utf8')) as LayerModel;
    let input: OntologyInput;
    let ids: Record<'Customer' | 'Client' | 'DiscountPolicy', string>;
    beforeAll(async () => {
      input = await prepareOntologyInput(dir, { layerModel: layers });
      ids = { Customer: nodeId(input, 'Class', 'Customer'), Client: nodeId(input, 'Class', 'Client'), DiscountPolicy: nodeId(input, 'Class', 'DiscountPolicy') };
    }, 120_000);
    const ctx = (cls: string, context: string, declared = true): Fact => fact(cls, 'inContext', { context, declared }, 'parser');
    const defines = (cls: string, k = 'sem:k1', agreement: 'agreed' | 'single-run' = 'agreed'): Fact => fact(cls, 'embodiesConcept', { concept: 'Customer', relation: 'defines', conceptId: k }, 'model', agreement);

    it('two differently-named definers in one declared context give one SEM-FRAG row', async () => {
      const v = await verdicts(input, layers, file([ctx(ids.Customer, 'sales'), ctx(ids.Client, 'sales'), defines(ids.Customer), defines(ids.Client)]));
      expect(v).toEqual([expect.objectContaining({ rule: 'SEM-FRAG', context: 'sales', sites: [ids.Customer, ids.Client].sort() })]);
    });

    it('across contexts, or in an undeclared component, SEM-FRAG is silent', async () => {
      expect(await verdicts(input, layers, file([ctx(ids.Customer, 'sales'), ctx(ids.Client, 'billing'), defines(ids.Customer), defines(ids.Client)]))).toEqual([]);
      expect(await verdicts(input, layers, file([ctx(ids.Customer, 'sales', false), ctx(ids.Client, 'sales', false), defines(ids.Customer), defines(ids.Client)]))).toEqual([]);
    });

    it('a three-member cluster with two names in sales and one in billing gives one sales row', async () => {
      const v = await verdicts(input, layers, file([ctx(ids.Customer, 'sales'), ctx(ids.Client, 'sales'), ctx(ids.DiscountPolicy, 'billing'), defines(ids.Customer), defines(ids.Client), defines(ids.DiscountPolicy)]));
      expect(v).toHaveLength(1);
      expect(v[0]).toMatchObject({ rule: 'SEM-FRAG', context: 'sales', sites: [ids.Customer, ids.Client].sort() });
    });

    it('$policy: a single-run fact counts under any, not under agreed-only; a policy other than the run\'s is refused', async () => {
      const facts = [ctx(ids.Customer, 'sales'), ctx(ids.Client, 'sales'), defines(ids.Customer), defines(ids.Client, 'sem:k1', 'single-run')];
      expect(await verdicts(input, layers, file(facts, 'agreed-only'))).toEqual([]);
      expect(await verdicts(input, layers, file(facts, 'any'))).toHaveLength(1);
      const repo = new MemoryGraphRepository();
      await loadFacts(input.apg, layers, file(facts, 'agreed-only'), repo);
      const refused = await runSemRules(repo, file(facts, 'agreed-only'), 'any');
      expect(refused).toMatchObject({ success: false, errors: [{ code: 'SEM_POLICY_MISMATCH' }] });
    });

    it('an input-validation rule at two contexts gives no SEM-DUP row; the same as a business rule gives one', async () => {
      const m1 = input.apg.nodes.find((n) => n.type === 'Method' && n.name.startsWith('DiscountPolicy.'))?.id ?? '';
      const m2 = input.apg.nodes.find((n) => n.type === 'Method' && n.name.startsWith('Customer.'))?.id ?? '';
      expect(m1).not.toBe('');
      expect(m2).not.toBe('');
      const rule = (m: string, kind: string): Fact => fact(m, 'enforcesRule', { statement: 's', subject: 'x', operator: '<=', threshold: 20, unit: null, kind, ruleId: 'sem:r1' }, 'model');
      const base = [ctx(ids.DiscountPolicy, 'sales'), ctx(ids.Customer, 'billing')];
      expect(await verdicts(input, layers, file([...base, rule(m1, 'input-validation'), rule(m2, 'input-validation')]))).toEqual([]);
      const dup = await verdicts(input, layers, file([...base, rule(m1, 'business'), rule(m2, 'business')]));
      expect(dup).toEqual([expect.objectContaining({ rule: 'SEM-DUP', verified: false })]);
    });
  });
});
