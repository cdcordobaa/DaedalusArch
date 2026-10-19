/**
 * v1.4 U9 (C4-01 §6, §9): the seeded case set on the in-process interpreter (`cypher-interp`, no Neo4j) with zero
 * model calls. The manifest hashes hold; every target blocking finding fires in C3 (or, for pair 6, in SEM-MISPLACED
 * over the scripted A2); the context builder takes every blocking finding with its code, docs, ADRs and comments; the
 * keyword baseline is right on the plain twins and fails on the two near-miss twins by design; a mock record replays
 * with 0 calls; the estimate counts calls without calling.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  INTERPRETATION_PROMPT_VERSION, MockOntologyProvider, NoCallProvider, c4MockResponder, estimateInterpretation, interpretFindings,
  interpretationPrompt,
} from '../../../../src/apg-enrich/ontology/index.js';
import { C4_FIXTURES, C4_SET, baselineOf, prepareC4Project, setTargets } from '../../../../scripts/v1.4/c4-run.js';
import type { C4Set, C4Target, PreparedProject } from '../../../../scripts/v1.4/c4-run.js';
import { canonicalJSON } from '../../../../src/llm-critic/canonical-json.js';
import { createInterpEvaluator } from '../../../../src/mcp-server/interp-evaluator.js';
import { tempDir } from './helpers.js';

const targets = setTargets();
const prepared = new Map<string, { t: C4Target; p: PreparedProject }>();

beforeAll(async () => {
  const evaluate = createInterpEvaluator();
  for (const t of targets) prepared.set(t.id, { t, p: await prepareC4Project(t, evaluate) });
}, 600_000);

const get = (id: string): { t: C4Target; p: PreparedProject } => {
  const x = prepared.get(id);
  if (x === undefined) throw new Error(`not prepared: ${id}`);
  return x;
};

describe('the seeded set index', () => {
  it('lists six pairs, the pilot pairs 1 and 2, and three non-author rows still to be filled', () => {
    const set = JSON.parse(readFileSync(C4_SET, 'utf8')) as C4Set & { nonAuthor: { id: string; status: string }[] };
    expect(set.pairs.map((p) => p.pair)).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(set.pilotPairs).toEqual(['1', '2']);
    expect(set.nonAuthor.map((x) => [x.id, x.status])).toEqual([['X1', 'to-be-filled'], ['X2', 'to-be-filled'], ['X3', 'to-be-filled']]);
    expect(setTargets(C4_SET, { pilot: true }).map((t) => t.id)).toEqual(['c4-01-adr-permits-read-skip', 'c4-01t-no-adr', 'c4-02-legacy-exception', 'c4-02t-no-legacy-record']);
  });

  it('every manifest matches its recorded SHA-256 and states its authorship (none signed, none independent yet)', () => {
    const set = JSON.parse(readFileSync(C4_SET, 'utf8')) as C4Set;
    for (const e of set.pairs.flatMap((p) => [p.case, p.twin])) {
      expect({ id: e.id, sha: createHash('sha256').update(readFileSync(join(C4_FIXTURES, e.manifest))).digest('hex') }).toEqual({ id: e.id, sha: e.manifestSha256 });
    }
    for (const t of targets) expect(t.manifest?.authorship).toMatchObject({ independentOfC4: false, signedByAuthor: false });
  });

  it('every twin is exception-negative and every claimed case names its planted lines', () => {
    for (const t of targets) {
      const m = t.manifest;
      if (m === null) throw new Error('no manifest');
      if (m.role === 'twin') expect(m.expected.exceptionClaimed).toBe(false);
      if (m.expected.exceptionClaimed) expect(m.expected.citations.length).toBeGreaterThan(0);
    }
  });
});

describe('C3 and the Sem rules produce every target (cypher-interp, no Neo4j)', () => {
  it.each(targets.map((t) => [t.id]))('%s: the target is a blocking finding, with at most two other blocking findings', (id) => {
    const { t, p } = get(id);
    const m = t.manifest;
    if (m === null) throw new Error('no manifest');
    const hit = p.findings.filter((f) => f.rule === m.target.rule && f.files[0] === m.target.file && (m.target.edgeTarget === undefined || f.edge?.target === m.target.edgeTarget));
    expect(hit).toHaveLength(1);
    expect(p.findings.length).toBeLessThanOrEqual(3);
    expect(p.findings.every((f) => f.tier === 'blocking')).toBe(true);
  });

  it('pair 6 reads A2: the SEM-MISPLACED verdict cites model facts loaded from the scripted mock run', () => {
    for (const id of ['c4-06-sem-documented', 'c4-06t-ns02-case-02']) {
      const { p } = get(id);
      expect(p.semVerdicts.map((v) => v.rule)).toEqual(['SEM-MISPLACED']);
      const f = p.findings.find((x) => x.rule === 'SEM-MISPLACED');
      expect(f?.facts.length).toBeGreaterThan(0);
      const facts = new Map((p.facts?.facts ?? []).map((x) => [x.id, x]));
      for (const id2 of f?.facts ?? []) expect(facts.get(id2)?.source).toBe('model');
      expect(p.items.find((i) => i.context.finding.id === f?.id)?.context.facts.length).toBe(f?.facts.length);
    }
  });
});

describe('the context builder takes every blocking finding (contract)', () => {
  it('symbolic and SEM findings both get code, the C3 verdict copied, and a prompt with no verdict request', () => {
    for (const { p } of prepared.values()) {
      for (const i of p.items) {
        const ctx = i.context;
        expect(ctx.code.length).toBeGreaterThan(0);
        expect(ctx.c3Verdict).toEqual({ rule: ctx.finding.rule, tier: 'blocking', verdict: 'fail' });
        const prompt = interpretationPrompt(ctx);
        expect(prompt).toContain(`C3: ${ctx.finding.rule} blocking fail`);
        expect(prompt).toContain('never moves the finding out of the blocking tier');
      }
    }
  });

  it('the planted docs, ADRs and comments reach the prompt of each target', () => {
    const want: Record<string, string> = {
      'c4-01-adr-permits-read-skip': 'Controllers may query read repositories directly.',
      'c4-02-legacy-exception': 'LEGACY: the TypeORM decorator on Order is allowed',
      'c4-03-shared-kernel': 'Money is a shared kernel between ordering and billing',
      'c4-03t-translate-through-acl': 'Money is not shared between the contexts',
      'c4-04-accepted-adr': 'The domain core is permitted to import SystemClock',
      'c4-04t-superseded-adr': 'Status: Superseded by ADR-0009',
      'c4-05-intent-contradicted': 'A controller never imports a repository',
      'c4-06-sem-documented': 'This is an accepted exception to keeping pricing rules in the domain layer.',
    };
    for (const [id, text] of Object.entries(want)) {
      const { t, p } = get(id);
      const target = p.items.find((i) => i.context.finding.rule === t.manifest?.target.rule && i.context.finding.files[0] === t.manifest.target.file);
      expect({ id, has: target !== undefined && interpretationPrompt(target.context).includes(text) }).toEqual({ id, has: true });
    }
    const t4 = get('c4-04t-superseded-adr').p.items[0];
    expect(t4 !== undefined && interpretationPrompt(t4.context).includes('ADR-0009')).toBe(true);
  });
});

describe('the keyword baseline on the set (C4-01 §6.2)', () => {
  it('is right on cases 1 to 4, clean on twins 1, 2 and 5, and claims falsely on the near-miss twins 3 and 4', () => {
    const claimed = (id: string): boolean => {
      const { t, p } = get(id);
      const b = baselineOf(p.items);
      const target = p.findings.find((f) => f.rule === t.manifest?.target.rule && f.files[0] === t.manifest.target.file);
      return target !== undefined && b.get(target.id)?.claimed === true;
    };
    for (const id of ['c4-01-adr-permits-read-skip', 'c4-02-legacy-exception', 'c4-03-shared-kernel', 'c4-04-accepted-adr']) expect({ id, c: claimed(id) }).toEqual({ id, c: true });
    for (const id of ['c4-01t-no-adr', 'c4-02t-no-legacy-record', 'c4-05-intent-contradicted', 'c4-05t-readme-silent']) expect({ id, c: claimed(id) }).toEqual({ id, c: false });
    for (const id of ['c4-03t-translate-through-acl', 'c4-04t-superseded-adr']) expect({ id, c: claimed(id) }).toEqual({ id, c: true });
  });
});

describe('the C4 run with zero model calls', () => {
  it('records the scripted mock into cassettes, then replays them with a no-call provider: same A5, 0 calls', async () => {
    const { dir, cleanup } = tempDir('c4-cass-');
    try {
      const { p } = get('c4-01-adr-permits-read-skip');
      const items = new Map(p.items.map((i) => [i.context.finding.id, i]));
      const rec = await interpretFindings(p.items, { provider: new MockOntologyProvider(c4MockResponder(items), 'mock-c4'), cacheMode: 'record', cacheDir: dir, now: () => '2026-10-19T00:00:00.000Z' });
      expect(rec.calls.providerCalls).toBe(2);
      const rep = await interpretFindings(p.items, { provider: new NoCallProvider({ provider: 'mock', model: 'mock-c4', temperature: null }), cacheMode: 'replay', cacheDir: dir });
      expect(rep.calls).toMatchObject({ providerCalls: 0, cacheHits: 2, cassetteMisses: 0 });
      expect(canonicalJSON(rep.entries)).toBe(canonicalJSON(rec.entries));
      expect(rep.entries[0]?.merged.exception).toMatchObject({ claimed: true, stability: 'agreed', citation: { path: 'docs/adr/0004-read-side.md', startLine: 11 } });
      expect(rep.entries[0]?.runs.every((r) => r.date === '2026-10-19T00:00:00.000Z' && r.modelId === 'mock-c4')).toBe(true);
      expect(rep.entries[0]?.promptVersion).toBe(INTERPRETATION_PROMPT_VERSION);
    } finally {
      cleanup();
    }
  });

  it('a replay with no cassette calls nothing and leaves every run invalid', async () => {
    const { dir, cleanup } = tempDir('c4-empty-');
    try {
      const { p } = get('c4-02-legacy-exception');
      const r = await interpretFindings(p.items, { provider: new NoCallProvider({ provider: 'claude-cli', model: 'x', temperature: null }), cacheMode: 'replay', cacheDir: dir });
      expect(r.calls.providerCalls).toBe(0);
      expect(r.entries.flatMap((e) => e.runs).every((x) => x.grounded === null && (x.invalidReason ?? '').startsWith('cassette miss'))).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('the estimate counts findings x runs (x2 upper bound) and prompt tokens, and calls nothing', () => {
    const items = [...prepared.values()].flatMap((x) => x.p.items);
    const e = estimateInterpretation(items, { provider: new NoCallProvider({ provider: 'claude-cli', model: 'x', temperature: null }), cacheMode: 'off', cacheDir: null, runs: 2, budget: 80 });
    expect(e.findings).toBe(16);
    expect(e).toMatchObject({ expectedCalls: 32, upperBound: 64, cached: 0, withinBudget: true });
    expect(e.promptTokens).toBeGreaterThan(1000);
  });
});
