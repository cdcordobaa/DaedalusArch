/** T-KEY, T-PERT, T-NORM, T-PARSE, T-CAP and T-A1 (design SC-1 to SC-12; A1 DR-A1-5). */
import {
  extractAnswer,
  graphEvidenceOf,
  itemTable,
  itemsCsv,
  jaccard,
  normaliseKey,
  normPath,
  rubricFor,
  RUBRICS,
  scoreSession,
  secondaryTables,
  selfTest,
} from '../../../../../scripts/v1.3/lib/eff01/score.js';
import type { Eff01Block, Eff01Condition, ScoreRecord, SessionRecord, SessionStatus } from '../../../../../scripts/v1.3/lib/eff01/types.js';
import { inputs } from './helpers.js';

const ins = inputs();

function key(qid: string): Record<string, unknown> {
  const q = ins.questionById.get(qid);
  if (q === undefined) throw new Error(qid);
  return normaliseKey(q.template, ins.keys.get(qid)?.answer);
}

function record(over: Partial<SessionRecord> & { questionId: string | null }): SessionRecord {
  const status: SessionStatus = over.status ?? 'completed';
  return {
    schema: 'eff-01-session/v1',
    sessionId: `${over.block ?? 'main'}/${over.repoId ?? 'ddd-forum'}/${over.questionId ?? 'calib'}/${over.condition ?? 'R'}/run-${String(over.run ?? 1)}`,
    block: 'main',
    repoId: (over.questionId ?? 'DF').startsWith('ES') ? 'event-sourcing-ddd' : 'ddd-forum',
    condition: 'R',
    run: 1,
    rerun: false,
    lane: 0,
    orderIndex: 0,
    argv: [],
    promptSha256: '',
    frameSha256: '',
    questionsSha256: '',
    answersSha256: '',
    specSha256: '',
    treeFingerprint: null,
    cliVersionStart: null,
    cliVersionEnd: null,
    cliDrift: false,
    model: { pinned: 'm', verdict: {} },
    modelSource: 'envelope',
    statusReason: null,
    valid: ['completed', 'cap-wall', 'cap-turns', 'cap-tokens'].includes(status),
    exitCode: 0,
    timedOut: false,
    truncated: false,
    resultSubtype: 'success',
    isError: false,
    agentError: false,
    tokens: { processed: 1000, uncached: 100, output: 10, usageTotal: 1000, usageMismatch: false, byModel: {}, auxProcessed: 0 },
    tokensSource: 'envelope',
    numTurns: 3,
    durationMs: 10,
    wallMs: 12,
    toolCalls: { total: 0, byName: {} },
    mcpCallLog: null,
    confinement: { ok: true, reasons: [] },
    attempts: [],
    interruptions: [],
    modelReachingAttempts: 1,
    permissionDenials: 0,
    answerText: null,
    finalText: null,
    maxTurnsRejected: false,
    dryRun: true,
    ...over,
    status,
  };
}

function score(qid: string, finalText: string, over: Partial<SessionRecord> = {}): ScoreRecord {
  const q = ins.questionById.get(qid) ?? null;
  const r = scoreSession(record({ questionId: qid, finalText, ...over }), q, ins.keys.get(qid)?.answer);
  if (!r.success) throw new Error(r.errors[0]?.message);
  return r.data;
}

const answer = (v: unknown): string => `Some reasoning.\nANSWER: ${JSON.stringify(v)}`;

describe('T-KEY: the key scores 1.0', () => {
  it('scores all 20 normalised key answers at 1.0 on every part (and --self-test agrees)', () => {
    expect(ins.questionById.size).toBe(20);
    for (const q of ins.questionById.values()) {
      const k = key(q.id);
      expect(Object.keys(k).sort()).toEqual(Object.keys(q.answerFormat).sort());
      const s = score(q.id, answer(k));
      expect(s.score).toBe(1);
      expect(Object.values(s.parts).every((p) => p > 0)).toBe(true);
    }
    expect(selfTest(ins)).toEqual({ total: 20, perfect: 20, failures: [] });
  });

  it('refuses a template it does not know', () => {
    expect(rubricFor('new-template').success).toBe(false);
    expect(Object.keys(RUBRICS)).toHaveLength(10);
  });
});

describe('T-PERT: one perturbation per template', () => {
  it('scores below 1 with the expected parts and secondary values', () => {
    expect(score('ES-Q01', answer({ layer: 'application' })).score).toBe(0);
    const q02 = score('ES-Q02', answer({ count: 24 }));
    expect(q02.score).toBe(0);
    expect(q02.secondary.relativeError).toBeCloseTo(1 / 23, 12);
    const files = key('DF-Q03').files as string[];
    const missing = score('DF-Q03', answer({ files: files.slice(1) }));
    expect(missing.score).toBe(0);
    expect(missing.secondary.jaccard).toBe(3 / 4);
    const extra = score('DF-Q03', answer({ files: [...files, 'src/modules/forum/domain/extra.ts'] }));
    expect(extra.secondary.jaccard).toBe(4 / 5);
    expect(score('DF-Q04', answer({ pair: 'application->infrastructure', count: 21 })).parts).toEqual({ pair: 0, count: 0.5 });
    expect(score('DF-Q05', answer({ files: 13, largestCycleGroup: 4 })).score).toBe(0.5);
    expect(score('DF-Q06', answer({ files: ['src/shared/core/Result.ts'], importers: 74 })).parts).toEqual({ files: 0.5, importers: 0 });
    expect(score('DF-Q07', answer({ 'forum->users': 25, 'users->forum': 0 })).parts).toEqual({ 'forum->users': 0, 'users->forum': 0.5 });
    expect(score('ES-Q08', answer({ allowed: false, fromLayer: 'infrastructure', toLayer: 'application' })).parts).toEqual({ allowed: 0, layers: 0.5 });
    expect(score('DF-Q09', answer({ implementers: [{ class: 'PostRepo', file: 'src/modules/forum/repos/postRepo.ts' }] })).parts).toEqual({ classes: 0.5, files: 0 });
    const q10 = score('DF-Q10', answer({ verdict: 'fail', blockingRules: ['FF-DS02', 'FF-DT01', 'FF-S01'] }));
    expect(q10.parts).toEqual({ verdict: 0.5, rules: 0 });
    expect(q10.secondary.jaccard).toBe(3 / 4);
  });
});

describe('T-NORM: value normalisation', () => {
  it('strips the redacted tree prefix, absolute clone paths and ./, and flags it', () => {
    const files = key('DF-Q03').files as string[];
    const abs = score('DF-Q03', answer({ files: files.map((f) => `<H>/trees/ddd-forum/${f}`) }));
    expect(abs.score).toBe(1);
    expect(abs.pathPrefixStripped).toBe(true);
    expect(abs.scoreStrict).toBe(0);
    const clone = score('DF-Q03', answer({ files: files.map((f) => `/home/x/clones/ddd-forum/${f}`) }));
    expect(clone.score).toBe(1);
    const dot = score('DF-Q03', answer({ files: files.map((f) => `./${f}`) }));
    expect(dot.score).toBe(1);
    expect(dot.pathPrefixStripped).toBe(true);
    expect(dot.scoreStrict).toBe(0);
    expect(score('DF-Q03', answer({ files })).pathPrefixStripped).toBe(false);
    expect(normPath('src\\a\\b.ts', { repoId: 'x' })?.value).toBe('src/a/b.ts');
  });

  it('normalises arrows, digit strings, boolean strings and rule-id case; keeps layer names case-sensitive', () => {
    expect(score('DF-Q04', answer({ pair: 'application → api', count: '21' })).score).toBe(1);
    expect(score('DF-Q08', answer({ allowed: 'false', fromLayer: 'domain', toLayer: 'infrastructure' })).score).toBe(1);
    expect(score('DF-Q10', answer({ verdict: 'FAIL', blockingRules: ['ff-ds02', 'ff-dt01', 'FF-DT02', 'ff-s01'] })).score).toBe(1);
    expect(score('ES-Q07', answer({ 'book → user': 1, 'user -> book': '0' })).score).toBe(1);
    expect(score('ES-Q01', answer({ layer: 'Infrastructure' })).score).toBe(0);
    expect(score('ES-Q01', answer({ layer: ' infrastructure ' })).score).toBe(1);
  });
});

describe('T-PARSE: the ANSWER line', () => {
  it('handles missing, repeated, fenced, trailing-prose and invalid answers', () => {
    expect(extractAnswer('no answer here').parse).toBe('missing');
    const two = extractAnswer('ANSWER: {"count": 1}\nthen\nANSWER: {"count": 50}');
    expect(two).toMatchObject({ parse: 'ok', payload: { count: 50 }, multipleAnswerLines: true });
    expect(extractAnswer('ANSWER: ```json {"count": 50}```').payload).toEqual({ count: 50 });
    expect(extractAnswer('ANSWER: `{"count": 50}`').payload).toEqual({ count: 50 });
    expect(extractAnswer('ANSWER: ```json\n{"count": 50}\n```').payload).toEqual({ count: 50 });
    expect(extractAnswer('ANSWER: {"count": 50} (from the tool)')).toMatchObject({ parse: 'extracted', payload: { count: 50 } });
    expect(extractAnswer('ANSWER: {count: 50').parse).toBe('unparsable');
    for (const t of ['no answer', 'ANSWER: {count: 50', 'ANSWER: 50']) expect(score('DF-Q02', t).score).toBe(0);
    expect(score('DF-Q02', 'ANSWER: {"count": 50}').parse).toBe('ok');
  });

  it('computes the relative error at t = 0 as an absolute error, and Jaccard of two empty sets as 1', () => {
    const r = RUBRICS['direction-violation-count']?.({ count: 3 }, { count: 0 }, { repoId: 'x' });
    expect(r?.secondary).toEqual({ relativeError: 3, absoluteErrorUsed: true });
    expect(jaccard(new Set(), new Set())).toBe(1);
    const empty = RUBRICS['files-importing-against-direction-from-layer']?.({ files: [] }, { files: [] }, { repoId: 'x' });
    expect(empty?.score).toBe(1);
    expect(empty?.secondary.jaccard).toBe(1);
  });
});

describe('T-CAP: caps and validity', () => {
  it('scores a cap hit 0 even when the answer equals the key, and keeps its tokens in the medians', () => {
    const k = answer(key('DF-Q02'));
    const caps: SessionStatus[] = ['cap-turns', 'cap-tokens', 'cap-wall'];
    const scores = caps.map((status, i) => score('DF-Q02', k, { status, run: i + 1, tokens: { processed: 500_000 + i, uncached: 0, output: 0, usageTotal: null, usageMismatch: false, byModel: {}, auxProcessed: 0 } }));
    for (const s of scores) {
      expect(s.score).toBe(0);
      expect(s.valid).toBe(true);
    }
    expect(scores.map((s) => s.capHit)).toEqual(caps);
    const rows = itemTable(scores, ins);
    const row = rows.find((r) => r.questionId === 'DF-Q02' && r.condition === 'R');
    expect(row).toMatchObject({ nRuns: 3, acc: 0, capHits: 3, tokMedian: 500_001, formatFailures: 0 });
  });

  it('excludes an invalid session from the items and never puts the pilot in them', () => {
    const k = answer(key('DF-Q02'));
    const invalid = score('DF-Q02', k, { status: 'confinement-leak' });
    expect(invalid.valid).toBe(false);
    const pilot = score('DF-Q02', k, { block: 'pilot' as Eff01Block });
    const ok = score('DF-Q02', k, { run: 2 });
    const rows = itemTable([invalid, pilot, ok], ins);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ nRuns: 1, acc: 1 });
  });

  it('gives calibration overhead and tokens per correct answer (null at a zero score)', () => {
    const cal = scoreSession(record({ questionId: null, block: 'calibration', condition: 'G', finalText: 'OK' }), null, undefined);
    if (!cal.success) throw new Error('cal');
    const wrong = score('DF-Q02', answer({ count: 1 }), { condition: 'G' as Eff01Condition });
    const right = score('DF-Q02', answer(key('DF-Q02')));
    const t = secondaryTables([cal.data, wrong, right]);
    expect(t.calibrationOverhead).toEqual({ R: null, G: 1000 });
    expect(t.tokensPerCorrect).toEqual({ 'G/ddd-forum': null, 'R/ddd-forum': 1000 });
  });
});

describe('T-A1: graph evidence (DR-A1-5)', () => {
  it('records graph tool use and citation for G only, and counts unused and uncited G runs per item', () => {
    const k = answer(key('DF-Q02'));
    const used = score('DF-Q02', `I ran evaluate_project.\n${k}`, { condition: 'G', toolCalls: { total: 2, byName: { Read: 1, 'mcp__daedalus-arch__evaluate_project': 1 } } });
    const unused = score('DF-Q02', k, { condition: 'G', run: 2, toolCalls: { total: 1, byName: { Read: 1 } } });
    const r = score('DF-Q02', k, { condition: 'R' });
    expect(used.graphEvidence).toEqual({ toolCalls: 1, cited: true });
    expect(unused.graphEvidence).toEqual({ toolCalls: 0, cited: false });
    expect(r.graphEvidence).toBeNull();
    expect(used.score).toBe(1);
    expect(unused.score).toBe(1);
    expect(graphEvidenceOf({ condition: 'G', toolCalls: { total: 0, byName: {} }, finalText: 'per mcp__daedalus-arch__which_layer' })).toEqual({ toolCalls: 0, cited: true });
    const rows = itemTable([used, unused, r], ins);
    expect(rows.find((x) => x.condition === 'G')).toMatchObject({ graphUnusedRuns: 1, graphUncitedRuns: 1, nRuns: 2 });
    expect(rows.find((x) => x.condition === 'R')).toMatchObject({ graphUnusedRuns: null, graphUncitedRuns: null });
    expect(itemsCsv(rows).split('\n')[0]).toContain('graphUnusedRuns,graphUncitedRuns');
  });
});
